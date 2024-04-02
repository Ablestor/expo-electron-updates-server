import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FindOptions } from 'sequelize';
import { BundleMetadata, BundlePlatform, RemoteConfig } from './bundle.types';
import { BundleManifest } from './models';

export class CreateBundleBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  githubReleaseName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty()
  @IsNotEmpty()
  metadata: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  remotes: string;

  getMetadata() {
    return JSON.parse(this.metadata) as BundleMetadata;
  }

  getRemotes() {
    return JSON.parse(this.remotes) as RemoteConfig[];
  }
}

export class BundleManifestFindQuery {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version: string;

  @ApiPropertyOptional({ type: BundlePlatform })
  @IsEnum(BundlePlatform)
  @IsOptional()
  platform: BundlePlatform;

  toFindOptions(): FindOptions<BundleManifest> {
    return {
      where: {
        ...(this.version ? { version: this.version } : {}),
        ...(this.platform ? { platform: this.platform } : {}),
      },
    };
  }
}
