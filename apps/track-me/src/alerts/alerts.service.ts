import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '@app/database';

@Injectable()
export class AlertsService {
    constructor(
        @InjectRepository(Alert)
        private alertRepository: Repository<Alert>,
    ) { }

    async findByGroup(groupId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const [alerts, total] = await this.alertRepository.findAndCount({
            where: { groupId },
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });

        return {
            alerts,
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    }
    async delete(id: number) {
        return this.alertRepository.delete(id);
    }
}
