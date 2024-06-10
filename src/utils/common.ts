import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class ManifestQueryDto<T> {
  @ApiProperty({
    description: 'platform',
    example: '.nupkg',
    type: 'string',
  })
  @IsOptional()
  platform: T;

  @ApiProperty({
    description: 'releaseName',
    example: 'dev',
    required: false,
  })
  @IsOptional()
  releaseName: string;
}
