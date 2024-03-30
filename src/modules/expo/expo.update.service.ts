import { ExpoUpdatesManifest } from '@expo/config';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import fs from 'fs/promises';

import { bundleNameRegexExpo, ExpoPlatform } from './expo.update.types';
import { ExpoModel } from './models';

import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { subtract } from '@util/array';
import { createHash, signRSASHA256 } from '@util/crypto';
import { isArray } from '@util/types';
import { hex2UUID } from '@util/uuid';
import mime from 'mime';
import path from 'path';
import { CreationAttributes } from 'sequelize';
import { Dictionary, serializeDictionary } from 'structured-headers';
import {
  ExpoAssetMetadataDto,
  ExpoBuildQueryDto,
  ExpoBuildRequestDto,
  ExpoMetadataDto,
  ExpoPlatformAssetMetadataDto,
  ExpoUpdateUserBodyDto,
  ManifestAndQueryListDto,
  ManifestRequestDto,
  UpdateUserManifestDto,
  UploadUpdateBodyDto,
} from './dtos';
import { ExpoAssetType } from './models/expo.asset.model';

@Injectable()
export class ExpoUpdateService {
  constructor(
    private readonly config: ConfigService,

    @InjectModel(ExpoModel.ExpoManifest)
    private readonly ExpoManifest: typeof ExpoModel.ExpoManifest,
    @InjectModel(ExpoModel.ExpoAsset)
    private readonly ExpoAsset: typeof ExpoModel.ExpoAsset,
    @InjectModel(ExpoModel.ExpoUpdateUser)
    private readonly ExpoUpdateUser: typeof ExpoModel.ExpoUpdateUser,
    @InjectModel(ExpoModel.ExpoBuild)
    private readonly ExpoBuild: typeof ExpoModel.ExpoBuild,
  ) {}

  async createManifest({
    assets: assetFiles,
    runtimeVersion,
    releaseName,
    metadata,
    expoClient,
  }: UploadUpdateBodyDto & { assets: Express.Multer.File[] }) {
    const manifestDtoList: CreationAttributes<ExpoModel.ExpoManifest>[] = [];
    const commonManifest = {
      uuid: this.getManifestUuid(metadata),
      runtimeVersion,
      releaseName,
      createdAt: new Date().toISOString(),
      metadata: {},
      extra: { expoClient },
    };

    const assetFileMap = new Map(assetFiles.map(f => [f.originalname, f]));

    const errors = [];
    if (metadata.fileMetadata.android) {
      try {
        const existManifest = await ExpoModel.ExpoManifest.findOne({
          where: { uuid: commonManifest.uuid, releaseName, platform: ExpoPlatform.Android },
        });
        if (!existManifest) {
          const [androidBundle, ...androidAssets] = await this.getOrCreateAssets(
            ExpoPlatform.Android,
            metadata.fileMetadata.android,
            assetFileMap,
          );

          manifestDtoList.push({
            ...commonManifest,
            platform: ExpoPlatform.Android,
            ExpoManifest_Assets: [...new Set(androidAssets.map(asset => asset.id))].map(
              assetId => ({ assetId }),
            ),
            launchAssetId: androidBundle.id,
          });
        }
      } catch (error) {
        if (isArray(error)) errors.push(...error);
        else errors.push(error);
      }
    }

    if (metadata.fileMetadata.ios) {
      try {
        const existManifest = await ExpoModel.ExpoManifest.findOne({
          where: { uuid: commonManifest.uuid, releaseName, platform: ExpoPlatform.IOS },
        });
        if (!existManifest) {
          const [iosBundle, ...iosAssets] = await this.getOrCreateAssets(
            ExpoPlatform.IOS,
            metadata.fileMetadata.ios,
            assetFileMap,
          );

          manifestDtoList.push({
            ...commonManifest,
            platform: ExpoPlatform.IOS,
            ExpoManifest_Assets: [...new Set(iosAssets.map(asset => asset.id))].map(assetId => ({
              assetId,
            })),
            launchAssetId: iosBundle.id,
          });
        }
      } catch (error) {
        if (isArray(error)) errors.push(...error);
        else errors.push(error);
      }
    }

    if (errors.length > 0)
      throw new BadRequestException({ message: 'Cannot Create Manifest', detail: { errors } });

    if (manifestDtoList.length > 0)
      await this.ExpoManifest.bulkCreate(manifestDtoList, {
        include: { association: this.ExpoManifest.associations.ExpoManifest_Assets },
      });
  }

  async getManifest({
    runtimeVersion,
    platform,
    releaseName,
  }: ManifestRequestDto & { releaseName: string }): Promise<ExpoUpdatesManifest> {
    const manifest = await this.ExpoManifest.findOne({
      where: { runtimeVersion, releaseName, platform },
      include: [
        { association: this.ExpoManifest.associations.assets },
        { association: this.ExpoManifest.associations.launchAsset, required: true },
      ],
      order: [['createdAt', 'desc']],
      rejectOnEmpty: new NotFoundException({
        message: `Cannot Find Manifest of runtimeVersion ${runtimeVersion}`,
        detail: { runtimeVersion },
      }),
    });

    if (!manifest.assets || !manifest.launchAsset) {
      throw new NotFoundException({
        message: `Cannot Find Assets of runtimeVersion ${runtimeVersion}`,
        detail: { runtimeVersion },
      });
    }
    const requestUrl = `${this.config.get('HOSTNAME')}/api/update/expo/assets`;

    const updatesManifestAssets = manifest.assets.map(asset => asset.toMetadata(requestUrl));
    const updatesManifestLaunchAsset = manifest.launchAsset.toMetadata(requestUrl);

    const updatesManifest: ExpoUpdatesManifest = {
      id: manifest.uuid,
      createdAt: new Date().toISOString(),
      runtimeVersion: manifest.runtimeVersion,
      launchAsset: updatesManifestLaunchAsset,
      assets: updatesManifestAssets,
      metadata: manifest.metadata,
      extra: manifest.extra,
    };

    return updatesManifest;
  }

  async getManifestById(manifestId: number, updaterId?: string) {
    const manifest = await ExpoModel.ExpoManifest.findOne({
      where: { id: manifestId },
      attributes: { exclude: ['deletedAt'] },
      include: [
        { association: this.ExpoManifest.associations.assets },
        { association: this.ExpoManifest.associations.launchAsset, required: true },
      ],
      order: [['createdAt', 'desc']],
    });

    if (!manifest)
      throw new NotFoundException({
        message: `Cannot Find Manifest for Id ${manifestId}`,
      });

    if (!manifest.assets || !manifest.launchAsset) {
      throw new NotFoundException({
        message: `Cannot Find Assets of runtimeVersion`,
      });
    }

    const requestUrl = `${this.config.get('HOSTNAME')}/api/update/expo/assets`;

    const updatesManifestAssets = manifest.assets.map(asset => asset.toMetadata(requestUrl));
    const updatesManifestLaunchAsset = manifest.launchAsset.toMetadata(requestUrl);

    let createdAt = manifest.createdAt.toISOString();
    let uuid = manifest.uuid;

    if (updaterId) {
      const updater = await this.ExpoUpdateUser.findOne({ where: { updaterId } });
      if (!updater)
        throw new NotFoundException({
          message: `Cannot Find Update user for Id ${updaterId}`,
        });

      createdAt =
        updater.createdAt !== updater.updatedAt
          ? createdAt > updater.updatedAt.toISOString()
            ? createdAt
            : updater.updatedAt.toISOString()
          : createdAt;

      if (updater.createdAt !== updater.updatedAt)
        uuid = hex2UUID(
          createHash(Buffer.from(JSON.stringify(updater.updatedAt)), 'sha256', 'hex'),
        );
    }

    const updatesManifest: ExpoUpdatesManifest = {
      id: uuid,
      createdAt,
      runtimeVersion: manifest.runtimeVersion,
      launchAsset: updatesManifestLaunchAsset,
      assets: updatesManifestAssets,
      metadata: manifest.metadata,
      extra: manifest.extra,
    };

    return updatesManifest;
  }

  async getManifestList({
    page = 1,
    limit = 10,
    platform,
    runtimeVersion,
    channelName,
  }: ManifestAndQueryListDto) {
    const offset = page > 1 ? (page - 1) * limit : 0;

    const rows = await this.ExpoManifest.findAll({
      where: {
        ...(platform ? { platform } : {}),
        ...(runtimeVersion ? { runtimeVersion } : {}),
        ...(channelName ? { releaseName: channelName } : {}),
      },
      order: [['createdAt', 'desc']],
      limit,
      offset,
      attributes: { exclude: ['uuid', 'metadata', 'deletedAt'] },
      include: { association: this.ExpoManifest.associations.user },
    });

    const count = await this.ExpoManifest.count({
      where: {
        ...(platform ? { platform } : {}),
        ...(runtimeVersion ? { runtimeVersion } : {}),
        ...(channelName ? { releaseName: channelName } : {}),
      },
    });

    return { rows, count };
  }

  async getAsset(assetUuid: string): Promise<ExpoModel.ExpoAsset> {
    const asset = await this.ExpoAsset.findOne({
      where: { uuid: assetUuid },
      rejectOnEmpty: new NotFoundException({
        message: `Cannot Find Asset of uuid ${assetUuid}`,
        detail: { assetUuid },
      }),
    });

    return asset;
  }

  async getSignature(manifest: ExpoUpdatesManifest) {
    const privateKey = await this.getPrivateKey();

    if (!privateKey)
      throw new BadRequestException(
        'Code signing requested but no key supplied when starting server.',
      );

    const manifestString = JSON.stringify(manifest);
    const hashSignature = signRSASHA256(manifestString, privateKey);

    const dictionary = this.convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: 'main',
    });

    return serializeDictionary(dictionary);
  }

  async getAssetRequestHeaders(manifest: ExpoUpdatesManifest) {
    return null;

    // const assetRequestHeaders: ExpoAssetHeader = {};

    // // [...manifest.assets, manifest.launchAsset].forEach(asset => {
    // //   assetRequestHeaders[asset.key] = {
    // //     'test-header': 'test-header-value',
    // //   };
    // // });

    // return assetRequestHeaders;
  }

  private getManifestUuid(metadata: ExpoMetadataDto) {
    const updateMetadataBuffer = Buffer.from(JSON.stringify(metadata));
    return hex2UUID(createHash(updateMetadataBuffer, 'sha256', 'hex'));
  }

  private async getOrCreateAssets(
    platform: ExpoPlatform,
    assetMetadata: ExpoPlatformAssetMetadataDto,
    fileMap: Map<string, Express.Multer.File>,
  ) {
    const assetDtoList: CreationAttributes<ExpoModel.ExpoAsset>[] = [];
    const errors: any[] = [];

    try {
      assetDtoList.push(this.getBundleCreateDto(platform, assetMetadata.bundle, fileMap));
    } catch (e) {
      errors.push(e);
    }
    assetMetadata.assets.forEach(asset => {
      try {
        assetDtoList.push(this.getAssetCreateDto(platform, asset, fileMap));
      } catch (e) {
        errors.push(e);
      }
    });

    if (errors.length > 0) throw errors;

    const existAssets = await this.ExpoAsset.findAll({
      where: { uuid: assetDtoList.map(({ uuid }) => uuid) },
    });
    const notExistAssets = subtract(
      assetDtoList,
      existAssets.map(({ uuid }) => uuid),
      d => d.uuid,
    );

    const createdAssets = await this.ExpoAsset.bulkCreate(notExistAssets);
    const createdAssetMap = new Map(createdAssets.map(asset => [asset.uuid, asset]));
    const existAssetMap = new Map(existAssets.map(asset => [asset.uuid, asset]));

    return assetDtoList.map(asset => {
      if (createdAssetMap.has(asset.uuid)) return createdAssetMap.get(asset.uuid);
      if (existAssetMap.has(asset.uuid)) return existAssetMap.get(asset.uuid);
      throw new BadRequestException(`Asset "${asset.uuid}" not found.`);
    }) as ExpoModel.ExpoAsset[];
  }

  private getAssetHash(file: Express.Multer.File): string {
    return createHash(file.buffer, 'sha256', 'base64url');
  }

  private getAssetCreateDto(
    platform: ExpoPlatform,
    { path: assetPath, ext }: ExpoAssetMetadataDto,
    fileMap: Map<string, Express.Multer.File>,
  ): CreationAttributes<ExpoModel.ExpoAsset> {
    const [, uuid] = assetPath.split('/');
    const file = fileMap.get(uuid);
    if (!file) throw new BadRequestException(`Asset "${uuid}" not found in uploaded files.`);

    const hash = this.getAssetHash(file);
    const contentType = mime.getType(ext) ?? file.mimetype ?? 'application/octet-stream';

    return { uuid: hex2UUID(uuid), platform, type: ExpoAssetType.Asset, ext, hash, contentType };
  }

  private getBundleCreateDto(
    platform: ExpoPlatform,
    assetPath: string,
    fileMap: Map<string, Express.Multer.File>,
  ): CreationAttributes<ExpoModel.ExpoAsset> {
    const [, filename] = assetPath.split('/');
    const file = fileMap.get(filename);
    if (!file) throw new BadRequestException(`Asset "${filename}" not found in uploaded files.`);

    const hash = this.getAssetHash(file);
    const contentType = 'application/javascript';
    const matchResult = filename.match(bundleNameRegexExpo);
    if (!matchResult)
      throw new BadRequestException(
        `Invalid bundle name: ${filename}. Bundle name must match ${bundleNameRegexExpo}`,
      );
    const [, , uuid] = matchResult;

    return {
      uuid: hex2UUID(uuid),
      platform,
      type: ExpoAssetType.Bundle,
      ext: 'bundle',
      hash,
      contentType,
    };
  }

  async createExpoUpdateUser({
    runtimeVersion,
    channelName: releaseName,
    updaterId,
    platform,
  }: ExpoUpdateUserBodyDto) {
    const reqManifest = await this.ExpoManifest.findOne({
      where: { releaseName, runtimeVersion, platform },
      order: [['createdAt', 'desc']],
    });

    if (!reqManifest)
      throw new NotFoundException({
        message: `Cannot Find Manifest for runtimeVersion ${runtimeVersion} or channelName ${releaseName}`,
      });

    const updater = await this.ExpoUpdateUser.findOne({
      where: { updaterId },
    });

    if (!updater) {
      // updater가 없으면 req manifest로 리턴
      await this.ExpoUpdateUser.create({ updaterId, manifestId: reqManifest.id });
      return reqManifest.id;
    } else {
      const updaterManifest = (await this.ExpoManifest.findOne({
        where: { id: updater.manifestId },
      })) as ExpoModel.ExpoManifest;

      // req Manifest랑 updater의 런타임과 플랫폼이 같고 최신이라면 updater의 manifest 리턴
      if (
        reqManifest.runtimeVersion === updaterManifest.runtimeVersion &&
        reqManifest.platform === updaterManifest.platform
      ) {
        const updaterLatestManifest = (await this.ExpoManifest.findOne({
          where: {
            runtimeVersion: updaterManifest.runtimeVersion,
            platform: updaterManifest.platform,
            releaseName: updaterManifest.releaseName,
          },
          order: [['createdAt', 'desc']],
        })) as ExpoModel.ExpoManifest;

        if (updaterManifest.id === updaterLatestManifest.id) return updaterManifest.id;
        else {
          await this.ExpoUpdateUser.update(
            { manifestId: updaterLatestManifest?.id },
            { where: { updaterId } },
          );
          return updaterLatestManifest.id;
        }
      } else {
        // req manifest와 runtime version과 platform이 다르면 유저의 manifest를 최신으로 변경
        await this.ExpoUpdateUser.update({ manifestId: reqManifest.id }, { where: { updaterId } });
        return reqManifest.id;
      }
    }
  }

  async getUpdaterWithManifest(updaterId: string) {
    const updater = await this.ExpoUpdateUser.findOne({
      where: { updaterId },
    });

    if (!updater)
      throw new NotFoundException({
        message: `Cannot Find update user ${updaterId}`,
      });

    const manifest = await this.ExpoManifest.findOne({
      where: { id: updater.manifestId },
      attributes: ['id', 'releaseName', 'runtimeVersion', 'platform'],
    });

    if (!manifest)
      throw new NotFoundException({
        message: `Cannot Find manifest for updaterId ${updaterId}`,
      });

    return {
      updaterId: updaterId,
      manifest,
    };
  }

  async getManifestInfo() {
    const manifests = await this.ExpoManifest.findAll({
      attributes: ['releaseName', 'runtimeVersion'],
    });

    const channel: string[] = [];
    const runtimeVersion: string[] = [];

    await Promise.all(
      manifests.map(manifest => {
        channel.push(manifest.releaseName);
        runtimeVersion.push(manifest.runtimeVersion);
      }),
    );

    return {
      channel: [...new Set(channel)].sort(),
      runtimeVersion: [...new Set(runtimeVersion)].sort(),
    };
  }

  async deleteManifestById(manifestId: number) {
    const manifest = await this.ExpoManifest.findOne({ where: { id: manifestId } });

    if (!manifest)
      throw new NotFoundException({
        message: `Cannot Find manifest for manifestId ${manifestId}}`,
      });

    await this.ExpoManifest.destroy({ where: { id: manifestId } });
  }

  async createExpoBuild({ version, channel, platform, link }: ExpoBuildRequestDto) {
    const existExpoBuild = await this.ExpoBuild.findOne({
      where: { version, channel, platform },
    });

    if (existExpoBuild)
      throw new BadRequestException({
        message: `Already exist build data (${version}, ${channel}, ${platform})`,
      });

    return this.ExpoBuild.create({ version, channel, platform, link });
  }

  async getBuildList({ page = 1, limit = 10, platform, version, channel }: ExpoBuildQueryDto) {
    const offset = page > 1 ? (page - 1) * limit : 0;

    return this.ExpoBuild.findAndCountAll({
      where: {
        ...(platform ? { platform } : {}),
        ...(version ? { version } : {}),
        ...(channel ? { channel } : {}),
      },
      attributes: { exclude: ['createdAt', 'updatedAt'] },
      order: [['createdAt', 'desc']],
      limit,
      offset,
    });
  }

  async updateUserManifest(
    updaterId: string,
    { runtimeVersion, platform, channelName: releaseName }: UpdateUserManifestDto,
  ) {
    const findUpdateManifest = await this.ExpoManifest.findOne({
      where: { runtimeVersion, platform, releaseName },
    });

    if (!findUpdateManifest)
      throw new NotFoundException({
        message: `Cannot Find Manifest for runtimeVersion ${runtimeVersion} or channelName ${releaseName}`,
      });

    return this.ExpoUpdateUser.update(
      { manifestId: findUpdateManifest.id },
      { where: { updaterId } },
    );
  }

  private async getPrivateKey() {
    const privateKeyPath = this.config.get('PRIVATE_KEY_PATH');
    if (!privateKeyPath) return null;

    return fs.readFile(path.resolve(privateKeyPath), 'utf8');
  }

  private convertToDictionaryItemsRepresentation(obj: { [key: string]: string }): Dictionary {
    return new Map(
      Object.entries(obj).map(([k, v]) => {
        return [k, [v, new Map()]];
      }),
    );
  }
}
