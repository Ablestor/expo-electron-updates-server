import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class QueryList {
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '검색어는 1~50 글자까지 가능합니다' })
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  limit: number = 10;

  @Type(() => String)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sort: string = 'createdAt';

  @Type(() => String)
  @IsOptional()
  @IsString()
  @IsIn(['DESC', 'ASC', 'desc', 'asc'])
  dir: string = 'DESC';
}
