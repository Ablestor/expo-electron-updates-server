import { ApiProperty } from '@nestjs/swagger';
import { Include, isNotNullable } from '@util/types';
import { ModelStatic } from 'sequelize';
import { Column, Model } from 'sequelize-typescript';
import { BINARY_UUID } from './types';

export abstract class BaseManifestModel<
    TInferAttributes extends {},
    TInferCreationAttributes extends {},
  >
  extends Model<
    TInferAttributes & IBaseManifest,
    TInferCreationAttributes & Omit<IBaseManifest, 'id' | `${string}At`>
  >
  implements IBaseManifest
{
  readonly id: number;

  @ApiProperty({
    description: 'manifest uuid',
  })
  @Column(BINARY_UUID())
  uuid: string;

  @ApiProperty({
    description: 'manifest version',
  })
  @Column
  version: string;

  @ApiProperty({
    description: 'manifest releaseName',
  })
  @Column
  githubReleaseName: string;

  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date | null;
}

interface IBaseManifest {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  uuid: string;
  version: string;
  githubReleaseName: string;
}

export const isModelClass = <T>(m: T): m is Include<T, ModelStatic<Model<any, any>>> =>
  isNotNullable(m) && (m as any).prototype instanceof Model;
