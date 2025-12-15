
import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { SosService } from './sos.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('sos')
@UseGuards(AuthGuard('jwt'))
export class SosController {
    constructor(private readonly sosService: SosService) { }

    @Post()
    triggerSos(@Request() req) {
        return this.sosService.sendSos(req.user.userId);
    }
}
