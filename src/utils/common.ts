import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class ManifestQueryDto<T> {
  @ApiProperty({
    description: 'platform',
    example: '.dmg',
    type: 'string',
  })
  @IsOptional()
  platform: T;

  @ApiProperty({
    description: 'version',
    example: '0.1.9',
  })
  @IsOptional()
  version?: string;

  @ApiProperty({
    description: 'releaseName',
    example: 'dev',
    required: false,
  })
  @IsOptional()
  releaseName: string;
}
