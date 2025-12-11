import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <-- הוספה
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { Area } from '@app/database'; // <-- הוספה

@Module({
  imports: [TypeOrmModule.forFeature([Area])], // <-- הוספה
  controllers: [AreasController],
  providers: [AreasService],
})
export class AreasModule { }