import { Injectable } from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Area } from '@app/database';
import { Repository } from 'typeorm';

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
  ) { }

  async create(createAreaDto: CreateAreaDto) {
    // טריק חשוב: פוליגון חייב "להיסגר". הנקודה האחרונה חייבת להיות זהה לנקודה הראשונה.
    // נבדוק אם המשתמש סגר את הפוליגון, ואם לא - נסגור בשבילו.
    const coords = createAreaDto.coordinates;
    const firstPoint = coords[0];
    const lastPoint = coords[coords.length - 1];

    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coords.push(firstPoint);
    }

    const area = this.areaRepository.create({
      name: createAreaDto.name,
      groupId: createAreaDto.groupId,
      polygon: {
        type: 'Polygon',
        coordinates: [coords], // GeoJSON דורש מערך בתוך מערך לפוליגונים
      } as any,
    });

    return await this.areaRepository.save(area);
  }

  findAll() {
    return this.areaRepository.find();
  }
}