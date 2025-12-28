
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@app/database';
import { Repository } from 'typeorm';
import { LocationGateway } from '../location/location.gateway';

@Injectable()
export class SosService {
    private readonly logger = new Logger(SosService.name);

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private locationGateway: LocationGateway,
    ) { }

    async sendSos(userId: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['memberships', 'memberships.group'],
        });

        if (!user || !user.memberships) return;

        this.logger.warn(`🚨 SOS Alert triggered by ${user.name} (${user.email})`);

        // Send message to all of the user's groups
        user.memberships.forEach((member) => {
            // Use the Socket.IO server directly to emit to group rooms
            this.locationGateway.server.to(member.group.id).emit('SOS_ALERT', {
                userId: user.id,
                userName: user.name,
                timestamp: new Date().toISOString(),
                message: 'User sent an SOS distress signal!',
            });
            this.logger.log(`Sent SOS to group ${member.group.name}`);
        });

        return { status: 'SOS sent' };
    }
}
