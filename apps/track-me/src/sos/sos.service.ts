
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, Alert } from '@app/database';
import { Repository } from 'typeorm';
import { LocationGateway } from '../location/location.gateway';

@Injectable()
export class SosService {
    private readonly logger = new Logger(SosService.name);

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Alert)
        private alertRepository: Repository<Alert>,
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
        const timestamp = new Date().toISOString();

        // Send message to all of the user's groups
        // Use for...of loop to handle async await properly
        for (const member of user.memberships) {
            // 1. Emit Socket Event
            this.locationGateway.server.to(member.group.id).emit('SOS_ALERT', {
                userId: user.id,
                userName: user.name,
                timestamp: timestamp,
                message: 'User sent an SOS distress signal!',
            });

            // 2. Save to Database
            const alert = this.alertRepository.create({
                groupId: member.group.id,
                userId: user.id,
                userName: user.name,
                type: 'SOS_ALERT',
                createdAt: new Date(),
                // areaId/areaName are nullable now
            });
            await this.alertRepository.save(alert);

            this.logger.log(`Sent SOS to group ${member.group.name} and saved to DB`);
        }

        return { status: 'SOS sent' };
    }
}
