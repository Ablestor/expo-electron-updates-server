import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ElectronPlatform } from './electron.types';

export class CreateManifestBody {
  @ApiProperty({
    enum: ElectronPlatform,
    example: '.nupkg',
  })
  @IsEnum(ElectronPlatform)
  @IsNotEmpty()
  platform: ElectronPlatform;

  @ApiProperty({
    example: '0.1.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({
    example: 'dev',
  })
  @IsString()
  @IsNotEmpty()
  releaseName: string;

  @ApiProperty({
    example: 'asldfjwijflkajlfskndalkjf78452234jsd08uf9asjdf',
  })
  @IsString()
  @IsOptional()
  hash?: string;
}

export class CheckManifestQuery {
  @ApiProperty({
    enum: ElectronPlatform,
    example: '.nupkg',
  })
  @IsEnum(ElectronPlatform)
  @IsNotEmpty()
  platform: ElectronPlatform;

  @ApiProperty({
    example: '0.1.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({
    example: 'z©  ã }g§PÐ  ÿ?ñ',
  })
  @IsString()
  @IsNotEmpty()
  uuid: string;
}

export class LatestManifestDownloadQuery {
  @ApiProperty({
    enum: ElectronPlatform,
    example: '.exe',
  })
  @IsEnum(ElectronPlatform)
  platform: ElectronPlatform;
}
