import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ManifestQueryDto } from '@util/common';
import { createHash } from '@util/crypto';
import { hex2UUID } from '@util/uuid';
import { Op } from 'sequelize';
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
  ) {}

  private getManifestUuid(version: string) {
    const updateMetadataBuffer = Buffer.from(JSON.stringify(version));
    return hex2UUID(createHash(updateMetadataBuffer, 'sha256', 'hex'));
  }

  async getElectronManifest({
    version,
    platform,
    releaseName,
  }: ManifestQueryDto<ElectronPlatform>) {
    return this.electronManifestRepo.findOne({
      where: { platform, releaseName, ...(version ? { version } : {}) },
      order: [['createdAt', 'desc']],
      rejectOnEmpty: new NotFoundException({
        message: `Cannot Find Manifest of version ${version}`,
        detail: { version },
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

  async createManifest({
    version,
    githubReleaseName,
    platform,
    releaseName,
    hash,
  }: CreateManifestBody) {
    const isExist = await this.githubService.existRelease(githubReleaseName);
    if (!isExist) throw new BadRequestException('Cannot create a release which does not exist');

    const [manifest] = await this.electronManifestRepo.findOrCreate({
      where: {
        uuid: this.getManifestUuid(githubReleaseName),
        version,
        githubReleaseName,
        platform,
        releaseName,
        hash,
      },
    });

    return manifest;
  }

  async checkLatestManifest(
    releaseName: string,
    { version, platform, githubReleaseName }: CheckManifestQuery,
  ) {
    const latestManifest = await this.electronManifestRepo.findOne({
      where: {
        version,
        platform,
        releaseName,
      },
      order: [['createdAt', 'desc']],
    });

    return latestManifest?.githubReleaseName === githubReleaseName ? true : false;
  }

  async getLatestManifestByPlatform(query: LatestManifestDownloadQuery) {
    return this.electronManifestRepo.findOne({
      where: {
        githubReleaseName: { [Op.like]: `%${query.githubReleaseName}%` },
        platform: query.platform,
      },
      order: [['createdAt', 'desc']],
    });
  }
}
