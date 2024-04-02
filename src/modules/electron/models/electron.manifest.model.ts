import { BaseManifestModel } from '@util/sequelize';
import { Column, Table } from 'sequelize-typescript';
import { ElectronPlatform } from '../electron.types';

@Table({
  tableName: 'ElectronManifest',
  modelName: 'ElectronManifest',
  timestamps: true,
  paranoid: true,
})
export class ElectronManifest
  extends BaseManifestModel<BundleManifestAttributes, BundleManifestCreationAttributes>
  implements IElectronManifest
{
  @Column
  platform: ElectronPlatform;

  @Column
  releaseName: string;
}

interface IElectronManifest {
  platform: ElectronPlatform;
  releaseName: string;
}

interface BundleManifestAttributes extends Omit<IElectronManifest, ''> {}

interface BundleManifestCreationAttributes
  extends Omit<BundleManifestAttributes, 'id' | `${string}At`> {}
