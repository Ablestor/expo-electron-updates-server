import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { ManifestQueryDto } from '@util/common';
import { createHash } from '@util/crypto';
import { hex2UUID } from '@util/uuid';
import { Client } from 'basic-ftp';
import { Readable } from 'stream';
import {
  CheckManifestQuery,
  CreateManifestBody,
  LatestManifestDownloadQuery,
} from './electron.dto';
import { ElectronPlatform } from './electron.types';
import { GithubService } from './github';
import { ElectronManifest } from './models';

@Injectable()
export class ElectronService {
  constructor(
    @InjectModel(ElectronManifest)
    private readonly electronManifestRepo: typeof ElectronManifest,
    private readonly githubService: GithubService,
    private readonly config: ConfigService,
  ) {}

  private getManifestUuid(version: string) {
    const updateMetadataBuffer = Buffer.from(JSON.stringify(version));
    return hex2UUID(createHash(updateMetadataBuffer, 'sha256', 'hex'));
  }

  async getElectronManifest({ platform, releaseName }: ManifestQueryDto<ElectronPlatform>) {
    return this.electronManifestRepo.findOne({
      where: { platform, releaseName },
      order: [['createdAt', 'desc']],
      rejectOnEmpty: new NotFoundException({
        message: `Cannot Find Manifest`,
      }),
    });
  }

  async getElectronManifestById(manifestId: number) {
    return this.electronManifestRepo.findOne({
      where: {
        id: manifestId,
      },
    });
  }

  async createManifest(
    { platform, releaseName, version, hash }: CreateManifestBody,
    file: Express.Multer.File,
  ) {
    const [createManifest] = await this.electronManifestRepo.findOrCreate({
      where: {
        platform,
        releaseName,
        version,
        hash,
        uuid: this.getManifestUuid(version),
      },
    });

    file.originalname = Buffer.from(file.originalname, 'ascii').toString('utf-8');
    const stream = Readable.from(file.buffer);

    const client = new Client();
    client.ftp.verbose = false;
    try {
      await client.access({
        host: this.config.get('FTP_HOST'),
        user: this.config.get('FTP_USER'),
        password: this.config.get('FTP_PASSWORD'),
        port: this.config.get('FTP_PORT'),
        secure: true,
        secureOptions: { rejectUnauthorized: false },
      });
      await client.cd(this.config.get('FTP_STORAGE_PATH'));
      await client.ensureDir(`./${createManifest.uuid}`);
      await client.ensureDir(`./${createManifest.releaseName}`);
      await client.uploadFrom(stream, `./${file.originalname}`);
      client.close();
    } catch (err) {
      throw err;
    }
  }

  async checkLatestManifest(releaseName: string, { version, platform }: CheckManifestQuery) {
    const latestManifest = await this.electronManifestRepo.findOne({
      where: {
        version,
        platform,
        releaseName,
      },
      order: [['createdAt', 'desc']],
    });

    if (!latestManifest) {
      throw new NotFoundException('Not Found Manifest');
    }

    return latestManifest.version === version ? true : false;
  }

  async getLatestManifestByPlatform(query: LatestManifestDownloadQuery) {
    const electronManifest = await this.electronManifestRepo.findOne({
      where: {
        platform: query.platform,
      },
      order: [['createdAt', 'desc']],
    });

    if (!electronManifest) {
      throw new NotFoundException('Not Found Manifest.');
    }

    if (electronManifest.platform === ElectronPlatform.DOWNWIN) {
      return `${this.config.get('NAS_HOST')}/${electronManifest.uuid}/${
        electronManifest.releaseName
      }/mommoss-${electronManifest.version} Setup${electronManifest.platform}`;
    } else {
      return `${this.config.get('NAS_HOST')}/${electronManifest.uuid}/${
        electronManifest.releaseName
      }/mommoss-${electronManifest.version}-${electronManifest.platform}`;
    }
  }

  async downloadElectronManifest(electronManifest: ElectronManifest) {
    if (electronManifest.platform === ElectronPlatform.WIN) {
      return `${this.config.get('NAS_HOST')}/${electronManifest.uuid}/${
        electronManifest.releaseName
      }/public-mommoss-${electronManifest.version}-full${electronManifest.platform}`;
    } else {
      if (electronManifest.platform === ElectronPlatform.X64) {
        return `${this.config.get('NAS_HOST')}/${electronManifest.uuid}/${
          electronManifest.releaseName
        }/public-mommoss-darwin-x64-${electronManifest.version}.zip`;
      } else {
        return `${this.config.get('NAS_HOST')}/${electronManifest.uuid}/${
          electronManifest.releaseName
        }/public-mommoss-darwin-arm64-${electronManifest.version}.zip`;
      }
    }
  }
}
