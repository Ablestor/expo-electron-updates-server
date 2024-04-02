import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ElectronPlatform } from './electron.types';

export class CreateManifestBody {
  @ApiProperty({
    enum: ElectronPlatform,
    example: '.dmg',
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
    example: 'foo-production',
  })
  @IsString()
  @IsNotEmpty()
  githubReleaseName: string;

  @ApiProperty({
    example: 'dev',
  })
  @IsString()
  @IsNotEmpty()
  releaseName: string;
}

export class CheckManifestQuery {
  @ApiProperty({
    enum: ElectronPlatform,
    example: '.dmg',
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
    example: 'foo-production',
  })
  @IsString()
  @IsNotEmpty()
  githubReleaseName: string;
}
