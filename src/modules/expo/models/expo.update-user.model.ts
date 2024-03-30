import { BelongsTo as BelongsToAssociation } from 'sequelize';
import { BelongsTo, Column, ForeignKey, Model, Table } from 'sequelize-typescript';
import { ExpoManifest } from './expo.manifest.model';

@Table({
  modelName: 'ExpoUpdateUser',
  tableName: 'ExpoUpdateUser',
})
export class ExpoUpdateUser extends Model<
  ExpoUpdateUserAttribute,
  ExpoUpdateUserCreationAttribute
> {
  readonly id: number;

  @Column
  updaterId: string;

  @ForeignKey(() => ExpoManifest)
  @Column
  manifestId: number;

  @BelongsTo(() => ExpoManifest)
  manifest?: ExpoManifest;

  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date | null;

  declare static associations: {
    expoManifest: BelongsToAssociation<ExpoUpdateUser, ExpoManifest>;
  };
}

interface IExpoUpdateUser {
  id: number;
  updaterId: string;
  manifestId: number;
  manifest?: ExpoManifest;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

interface ExpoUpdateUserAttribute extends IExpoUpdateUser {}
interface ExpoUpdateUserCreationAttribute
  extends Omit<ExpoUpdateUserAttribute, 'id' | `${string}At`> {}
