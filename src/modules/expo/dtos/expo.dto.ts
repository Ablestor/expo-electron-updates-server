import { ExpoClientConfig, Platform } from '@expo/config';
import { TransformJsonString, createValidator } from '@util/validator';
import { Expose, Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ExpoPlatform } from '../expo.update.types';
import { QueryList } from './common.dto';

export class ManifestRequestHeaderDto {
  @Expose({ name: 'expo-platform', toClassOnly: true })
  @IsOptional()
  platform?: Platform;

  @Expose({ name: 'expo-runtime-version', toClassOnly: true })
  @IsOptional()
  runtimeVersion?: string;

  @Expose({ name: 'expo-release-channel', toClassOnly: true })
  @IsOptional()
  channelName?: string;

  @Expose({ name: 'expo-expect-signature', toClassOnly: true })
  @IsOptional()
  expectSignature?: string;

  @Expose({ name: 'eas-client-id', toClassOnly: true })
  @IsOptional()
  updaterId?: string;

  static validate = createValidator(ManifestRequestHeaderDto, { sync: true });
}

export class ExpoUpdateUserBodyDto {
  @IsNotEmpty()
  runtimeVersion: string;

  @IsNotEmpty()
  channelName: string;

  @IsNotEmpty()
  platform: Platform;

  @IsNotEmpty()
  updaterId: string;
}

//TODO: dto 네이밍 바꿔야할듯
export class UpdateUserManifestDto {
  @IsNotEmpty()
  runtimeVersion: string;

  @IsNotEmpty()
  channelName: string;

  @IsNotEmpty()
  platform: Platform;
}

export class ManifestQueryDto {
  @Expose({ name: 'platform', toClassOnly: true })
  @IsOptional()
  platform?: Platform;

  @Expose({ name: 'runtime-version', toClassOnly: true })
  @IsOptional()
  runtimeVersion?: string;

  @Expose({ name: 'channel-name', toClassOnly: true })
  @IsOptional()
  channelName?: string;
}

export class ManifestAndQueryListDto extends QueryList {
  @Expose({ name: 'platform', toClassOnly: true })
  @IsOptional()
  platform?: Platform;

  @Expose({ name: 'runtime-version', toClassOnly: true })
  @IsOptional()
  runtimeVersion?: string;

  @Expose({ name: 'channel-name', toClassOnly: true })
  @IsOptional()
  channelName?: string;
}

export class ManifestRequestDto {
  @Expose()
  @IsNotEmpty()
  @IsIn(['ios', 'android'])
  platform: Platform;

  @Expose()
  @IsNotEmpty()
  runtimeVersion: string;

  @Expose()
  @IsOptional()
  channelName: string;

  @Expose()
  @IsOptional()
  expectSignature?: string;

  static validate = createValidator(ManifestRequestDto, {
    sync: true,
    transformToInstanceOptions: {
      enableImplicitConversion: true,
      excludeExtraneousValues: true,
      exposeDefaultValues: true,
    },
  });
}

export class ExpoAssetMetadataDto {
  @IsNotEmpty()
  path: string;

  @IsNotEmpty()
  ext: string;
}

export class ExpoPlatformAssetMetadataDto {
  @IsNotEmpty()
  bundle: string;

  @Type(() => ExpoAssetMetadataDto)
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  assets: ExpoAssetMetadataDto[];
}

class ExpoFileMetadataDto {
  @Type(() => ExpoPlatformAssetMetadataDto)
  @IsOptional()
  @ValidateNested()
  android?: ExpoPlatformAssetMetadataDto;

  @Type(() => ExpoPlatformAssetMetadataDto)
  @IsOptional()
  @ValidateNested()
  ios?: ExpoPlatformAssetMetadataDto;
}

export class ExpoMetadataDto {
  @IsNotEmpty()
  version: number;

  @IsNotEmpty()
  bundler: string;

  @Type(() => ExpoFileMetadataDto)
  @IsNotEmpty()
  @ValidateNested()
  fileMetadata: ExpoFileMetadataDto;
}

export class UploadUpdateBodyDto {
  @IsNotEmpty()
  runtimeVersion: string;

  @IsNotEmpty()
  releaseName: string;

  @TransformJsonString()
  @Transform(({ value }) => {
    return plainToInstance(ExpoMetadataDto, value);
  })
  @IsNotEmpty()
  @ValidateNested()
  metadata: ExpoMetadataDto;

  @TransformJsonString()
  @IsOptional()
  @IsObject()
  expoClient?: ExpoClientConfig;
}

export class ExpoBuildRequestDto {
  @Expose({ name: 'platform', toClassOnly: true })
  @IsNotEmpty()
  platform: ExpoPlatform;

  @Expose({ name: 'runtime-version', toClassOnly: true })
  @IsNotEmpty()
  version: string;

  @Expose({ name: 'channel-name', toClassOnly: true })
  @IsNotEmpty()
  channel: string;

  @IsNotEmpty()
  @IsString()
  link: string;
}

export class ExpoBuildQueryDto extends QueryList {
  @Expose({ name: 'platform', toClassOnly: true })
  @IsOptional()
  platform?: ExpoPlatform;

  @Expose({ name: 'runtime-version', toClassOnly: true })
  @IsOptional()
  version?: string;

  @Expose({ name: 'channel-name', toClassOnly: true })
  @IsOptional()
  channel?: string;
}
