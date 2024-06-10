import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ManifestQueryDto } from '@util/common';
import { Response } from 'express';
import {
  CheckManifestQuery,
  CreateManifestBody,
  LatestManifestDownloadQuery,
} from './electron.dto';
import { ElectronService } from './electron.service';
import { ElectronPlatform } from './electron.types';
import { GithubService } from './github';

@ApiTags('electron')
@Controller('electron')
export class ElectronController {
  constructor(
    private readonly electronService: ElectronService,
    private readonly githubService: GithubService,
  ) {}

  @ApiOperation({
    summary: '최신 electron manifest',
  })
  @Get('manifests/release/:releaseName/latest')
  async getLatestElectronManifest(
    @Query() query: ManifestQueryDto<ElectronPlatform>,
    @Param('releaseName') releaseName: string,
  ) {
    const manifest = await this.electronService.getElectronManifest({
      version: query.version,
      platform: query.platform,
      releaseName,
    });

    return manifest;
  }

  @ApiOperation({
    summary: 'check latest manifest',
  })
  @Get('manifests/release/:releaseName/latest/check')
  async checkLatestManifest(
    @Query() query: CheckManifestQuery,
    @Param('releaseName') releaseName: string,
  ) {
    return this.electronService.checkLatestManifest(releaseName, query);
  }

  @ApiOperation({
    summary: 'manifest asset download',
    description: 'manifest id에 해당하는 manifest를 다운로드함.',
  })
  @Get('manifests/:manifestId')
  async getManifest(@Param('manifestId') manifestId: number, @Res() res: Response) {
    const electronManifest = await this.electronService.getElectronManifestById(manifestId);

    if (!electronManifest) {
      throw new NotFoundException('Not Found Manifest.');
    }

    const downloadUrl = await this.electronService.downloadElectronManifest(electronManifest);

    console.log(downloadUrl);

    res.redirect(downloadUrl);
  }

  @ApiOperation({
    summary: 'create electron manifest',
  })
  @Post('manifests')
  @UseInterceptors(FileInterceptor('file'))
  async createManifest(
    @Body() createBody: CreateManifestBody,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.electronService.createManifest(createBody, file);
  }

  @ApiOperation({
    summary: 'get latest manifest installer',
  })
  @Get('manifests/latest/download')
  async getLatestInstaller(@Query() query: LatestManifestDownloadQuery, @Res() res: Response) {
    const electronManifest = await this.electronService.getLatestManifestByPlatform(query);

    if (!electronManifest?.platform) {
      return res.status(404).send();
    }
  }
}
