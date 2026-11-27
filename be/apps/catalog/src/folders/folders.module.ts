import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkFolder } from './artwork-folder.entity';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';

@Module({
  imports: [TypeOrmModule.forFeature([ArtworkFolder])],
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FoldersModule {}
