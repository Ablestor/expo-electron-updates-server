import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from 'octokit';

@Injectable()
export class GithubService implements OnApplicationBootstrap {
  private octokit: Octokit;
  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    this.octokit = new Octokit({
      auth: this.config.get('GIT_TOKEN'),
    });
  }

  async getReleaseAssets(tag: string) {
    const {
      data: { assets },
    } = await this.octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
      owner: this.config.get('GIT_OWNER'),
      repo: this.config.get('GIT_REPOSITORY'),
      tag,
    });

    const selectedManifestAsset = assets.find(asset => asset.name.includes('.zip'));
    if (!selectedManifestAsset) throw new NotFoundException(`Cannot Find Asset`);

    const asset = await this.octokit.request(
      'GET /repos/{owner}/{repo}/releases/assets/{asset_id}',
      {
        owner: this.config.get('GIT_OWNER'),
        repo: this.config.get('GIT_REPOSITORY'),
        asset_id: selectedManifestAsset.id,
        headers: {
          Accept: 'application/octet-stream',
        },
      },
    );

    if (!asset.url) throw new InternalServerErrorException('Unknown error');

    return asset.url;
  }

  async existRelease(tag: string) {
    try {
      const { data: release } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/releases/tags/{tag}',
        {
          owner: this.config.get('GIT_OWNER'),
          repo: this.config.get('GIT_REPOSITORY'),
          tag,
        },
      );
      if (!release) return false;
      return true;
    } catch (err) {
      return false;
    }
  }
}
