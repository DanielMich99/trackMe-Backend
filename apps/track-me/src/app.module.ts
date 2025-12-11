import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '@app/database'; // הייבוא החכם מהספרייה שיצרנו
import { LocationModule } from './location/location.module';

@Module({
  imports: [DatabaseModule, LocationModule], 
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}