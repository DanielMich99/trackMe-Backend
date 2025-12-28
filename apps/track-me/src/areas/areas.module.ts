import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { Area, GroupMember } from '@app/database';

@Module({
  imports: [TypeOrmModule.forFeature([Area, GroupMember])],
  controllers: [AreasController],
  providers: [AreasService],
})
export class AreasModule { }