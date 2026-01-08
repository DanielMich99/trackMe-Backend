import { Controller, Get, Param, Query, UseGuards, Req, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
    constructor(private readonly alertsService: AlertsService) { }

    @Get('group/:groupId')
    @UseGuards(AuthGuard('jwt'))
    async getByGroup(
        @Param('groupId') groupId: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        return this.alertsService.findByGroup(
            groupId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }
    @Delete(':id')
    @UseGuards(AuthGuard('jwt'))
    async delete(@Param('id') id: string) {
        return this.alertsService.delete(parseInt(id));
    }
}
