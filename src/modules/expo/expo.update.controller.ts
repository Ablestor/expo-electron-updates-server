import { ExpoUpdatesManifest } from '@expo/config';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import FormData from 'form-data';
import lodash from 'lodash';
import { Sequelize } from 'sequelize-typescript';
import { Readable } from 'stream';

import { ApiTags } from '@nestjs/swagger';
import {
  ExpoBuildQueryDto,
  ExpoBuildRequestDto,
  ManifestAndQueryListDto,
  ManifestQueryDto,
  ManifestRequestDto,
  ManifestRequestHeaderDto,
  UpdateUserManifestDto,
  UploadUpdateBodyDto,
} from './dtos';
import { ExpoUpdateService } from './expo.update.service';
import { FileTransactionInterceptor } from './multer';

@ApiTags('expo')
@Controller('expo')
export class ExpoUpdateController {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
    private readonly expoUpdateService: ExpoUpdateService,
  ) {}

  @Get('users/:updaterId')
  async getUpdaterManifest(@Param('updaterId') updaterId: string) {
    const updaterWithManifest = await this.expoUpdateService.getUpdaterWithManifest(updaterId);

    return updaterWithManifest;
  }

  @Put('users/:updaterId')
  async editUpdaterManifest(
    @Param('updaterId') updaterId: string,
    @Body() updateData: UpdateUserManifestDto,
  ) {
    await this.expoUpdateService.updateUserManifest(updaterId, updateData);
  }

  /**
   * @todo Support expo-manifest-filters and expo-server-defined-headers
   */
  @Header('cache-control', 'private, max-age=0')
  @Header('expo-protocol-version', '0')
  @Header('expo-sfv-version', '0')
  @Get('manifests/release/:releaseName/latest')
  async getLatestManifestByReleaseName(
    @Headers() headers: ManifestRequestHeaderDto,
    @Query() query: ManifestQueryDto,
    @Param('releaseName') releaseName: string,
    @Res() res: Response,
  ) {
    headers = ManifestRequestHeaderDto.validate(headers);
    const options = ManifestRequestDto.validate(lodash.defaults({}, headers, query));
    Logger.debug(JSON.stringify({ headers, options }));

    const form = new FormData();

    let manifest: ExpoUpdatesManifest;

    if (headers.updaterId) {
      const manifestId = await this.expoUpdateService.createExpoUpdateUser({
        runtimeVersion: options.runtimeVersion,
        channelName: releaseName,
        platform: options.platform,
        updaterId: headers.updaterId,
      });
      manifest = await this.expoUpdateService.getManifestById(manifestId, headers.updaterId);
    } else manifest = await this.expoUpdateService.getManifest({ ...options, releaseName });

    let signature = null;
    // TODO: Parse expectSignature & use it properly
    if (options.expectSignature) signature = await this.expoUpdateService.getSignature(manifest);

    form.append('manifest', JSON.stringify(manifest), {
      contentType: 'application/json',
      header: {
        'content-type': 'application/json; charset=utf-8',
        ...(signature ? { 'expo-signature': signature } : {}),
      },
    });

    // No extensions
    // If you need extensions, you can modify `expoUpdateService.getAssetRequestHeaders` to return the headers you need
    const assetRequestHeaders = await this.expoUpdateService.getAssetRequestHeaders(manifest);

    if (assetRequestHeaders)
      form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
        contentType: 'application/json',
      });

    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    return Readable.from(form.getBuffer()).pipe(res);
  }

  @Get('manifests')
  async getManifestList(@Query() query: ManifestAndQueryListDto) {
    const manifestList = await this.expoUpdateService.getManifestList(query);

    return manifestList;
  }

  @Get('manifests/info')
  async getManifestInfoList() {
    return this.expoUpdateService.getManifestInfo();
  }

  @Header('cache-control', 'private, max-age=0')
  @Header('expo-protocol-version', '0')
  @Header('expo-sfv-version', '0')
  @Get('manifests/:manifestId')
  async getManifest(@Res() res: Response, @Param('manifestId') manifestId: number) {
    const manifest = await this.expoUpdateService.getManifestById(manifestId);

    const form = new FormData();

    let signature = null;
    // // TODO: Parse expectSignature & use it properly
    signature = await this.expoUpdateService.getSignature(manifest);

    form.append('manifest', JSON.stringify(manifest), {
      contentType: 'application/json',
      header: {
        'content-type': 'application/json; charset=utf-8',
        ...(signature ? { 'expo-signature': signature } : {}),
      },
    });

    // No extensions
    // If you need extensions, you can modify `expoUpdateService.getAssetRequestHeaders` to return the headers you need
    const assetRequestHeaders = await this.expoUpdateService.getAssetRequestHeaders(manifest);

    if (assetRequestHeaders)
      form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
        contentType: 'application/json',
      });

    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    return Readable.from(form.getBuffer()).pipe(res);
  }

  @Delete('manifests/:manifestId')
  async deleteManifest(@Param('manifestId') manifestId: number) {
    await this.expoUpdateService.deleteManifestById(manifestId);
  }

  @Post('build')
  async addManifestLink(@Body() buildData: ExpoBuildRequestDto) {
    return this.expoUpdateService.createExpoBuild(buildData);
  }

  @Get('build')
  async getBuildList(@Query() query: ExpoBuildQueryDto) {
    return this.expoUpdateService.getBuildList(query);
  }

  // Set cache-control to maximum value, 1 year
  @Header('cache-control', 'public, max-age=31536000, immutable')
  @Get('assets/:assetId')
  async getAsset(@Param('assetId') assetUuid: string, @Res() res: Response) {
    const asset = await this.expoUpdateService.getAsset(assetUuid);

    res.set('content-type', asset.contentType);
    return asset.toStream(this.config.get('FILE_LOCAL_STORAGE_PATH')).pipe(res);
  }

  /**
   * @todo Support upload compressed build files, like build.tar.gz
   */
  @UseInterceptors(FilesInterceptor('assets'), FileTransactionInterceptor)
  @Post('upload')
  async uploadUpdateFiles(
    @UploadedFiles() assets: Express.Multer.File[],
    @Body() updateDto: UploadUpdateBodyDto,
  ) {
    await this.sequelize.transaction(async () => {
      await this.expoUpdateService.createManifest({ assets, ...updateDto });
    });
  }
}
