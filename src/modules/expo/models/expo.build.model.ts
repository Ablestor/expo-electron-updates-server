import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { ExpoPlatform, ExpoPlatformList } from '../expo.update.types';

@Table({
  modelName: 'ExpoBuild',
  tableName: 'ExpoBuild',
})
export class ExpoBuild
  extends Model<ExpoBuildAttribute, ExpoBuildCreationAttribute>
  implements IExpoBuild
{
  readonly id: number;

  @Column
  version: string;

  @Column
  channel: string;

  @Column(DataType.ENUM(...ExpoPlatformList))
  platform: ExpoPlatform;

  @Column
  link: string;

  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date | null;
}

interface IExpoBuild {
  id: number;
  version: string;
  channel: string;
  platform: ExpoPlatform;
  link: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

interface ExpoBuildAttribute extends IExpoBuild {}
interface ExpoBuildCreationAttribute extends Omit<ExpoBuildAttribute, 'id' | `${string}At`> {}
