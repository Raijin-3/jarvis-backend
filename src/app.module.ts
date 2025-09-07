import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DashboardController } from './dashboard.controller';
import { ProfilesService } from './profiles.service';
import { ProfileController } from './profile.controller';
import { ProfileApiController } from './profile.api.controller';
import { DebugController } from './debug.controller';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { CurriculumController } from './curriculum.controller';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathService } from './learning-path.service';
import { AuthModule } from './auth/auth.module';
import { QuizModule } from './quiz.module';

@Module({
  imports: [QuizModule, AuthModule],
  controllers: [
    AppController,
    DashboardController,
    ProfileController,
    ProfileApiController,
    DebugController,
    AssessmentController,
    CurriculumController,
    CourseController,
    LearningPathController,
  ],
  providers: [AppService, ProfilesService, AssessmentService, CourseService, LearningPathService],
})
export class AppModule {}
