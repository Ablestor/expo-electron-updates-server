import { UploadAsset } from '@module/multer';
import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Sequelize } from 'sequelize-typescript';
import { BundleManifestFindQuery, CreateBundleBody } from './bundle.dto';
import { BundleService } from './bundle.service';
import { BundleManifest } from './models';

@ApiTags('bundle')
@Controller('bundle')
export class BundleController {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(BundleManifest) private readonly bundleManifestRepo: typeof BundleManifest,
    private readonly bundleService: BundleService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'get latest bundle manifest',
  })
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Get('manifests/release/:releaseName/latest')
  async getLatestBundleManifestByReleaseName(
    @Param('githubReleaseName') githubReleaseName: string,
    @Query() query: BundleManifestFindQuery,
  ) {
    const { where } = query.toFindOptions();
    const manifest = await this.bundleManifestRepo.findOne({
      where: {
        githubReleaseName,
        ...where,
      },
      include: [
        { association: BundleManifest.associations.assets, required: true },
        { association: BundleManifest.associations.typeIndexJson },
      ],
      order: [['createdAt', 'desc']],
      rejectOnEmpty: new NotFoundException(`Not Found bundle manifest(${githubReleaseName})`),
    });

    const host = `${this.config.get('HOSTNAME')}/api/bundle/assets`;

    return {
      id: manifest.id,
      version: manifest.version,
      platform: manifest.platform,
      remotes: manifest.remotes,
      bundler: manifest.bundler,
      assets: manifest.assets?.map(asset => asset.toResponse(host)),
      typeIndexJson: manifest.typeIndexJson?.toResponse(host),
    };
  }

  @ApiOperation({
    summary: 'get asset file',
  })
  @Header('cache-control', 'public, max-age=31536000, immutable')
  @Get('assets/:assetId')
  async getAsset(@Param('assetId') assetUuid: string, @Res() res: Response) {
    const asset = await this.bundleService.getAsset(assetUuid);

    res.setHeader('content-type', asset.contentType as string);
    return asset.toStream().pipe(res);
  }

  @ApiOperation({
    summary: 'get asset file by manifestId & path',
  })
  @Header('cache-control', 'public, max-age=31536000, immutable')
  @Get('manifests/:manifestId/assets/*')
  async getAssetWithPath(
    @Param('manifestId') manifestId: number,
    @Param('0') path: string,
    @Res() res: Response,
  ) {
    const asset = await this.bundleService.getAssetByPath(manifestId, path);

    res.setHeader('content-type', asset.contentType as string);
    return asset.toStream().pipe(res);
  }

  @ApiOperation({
    summary: 'create bundle manifest with assets',
  })
  @UploadAsset('bundle')
  @Post('upload')
  async createBundle(
    @UploadedFiles()
    bundleFiles: Express.Multer.File[],
    @Body() bundleData: CreateBundleBody,
  ) {
    /** @todo Define swagger body on this*/
    await this.sequelize.transaction(async () => {
      await this.bundleService.createBundle(bundleFiles, bundleData);
    });
  }
}
