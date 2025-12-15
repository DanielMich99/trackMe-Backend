
import { Module } from '@nestjs/common';
import { SosService } from './sos.service';
import { SosController } from './sos.controller';
import { LocationGateway } from '../location/location.gateway'; // נשתמש ב-Gateway הקיים כדי לשדר
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Group } from '@app/database';

import { LocationModule } from '../location/location.module';

@Module({
    imports: [TypeOrmModule.forFeature([User, Group]), LocationModule],
    controllers: [SosController],
    providers: [SosService],
})
export class SosModule { }
