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
      },
      defaults: {
        platform,
        releaseName,
        version,
        hash,
        uuid: this.getManifestUuid(version),
      },
    });

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
      console.log(await client.pwd());
      await client.uploadFrom(stream, `./${file.originalname}`);
      client.close();
    } catch (err) {
      throw err;
    }
  }

  async checkLatestManifest(releaseName: string, { version, platform, uuid }: CheckManifestQuery) {
    const latestManifest = await this.electronManifestRepo.findOne({
      where: {
        version,
        platform,
        releaseName,
      },
      order: [['createdAt', 'desc']],
    });

    return latestManifest?.uuid === uuid ? true : false;
  }

  async getLatestManifestByPlatform(query: LatestManifestDownloadQuery) {
    return this.electronManifestRepo.findOne({
      where: {
        platform: query.platform,
      },
      order: [['createdAt', 'desc']],
    });
  }

  async downloadElectronManifest(electronManifest: ElectronManifest) {}
}
