import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DashboardController } from './dashboard.controller';
import { ProfilesService } from './profiles.service';
import { ProfileController } from './profile.controller';
import { ProfileApiController } from './profile.api.controller';
import { DebugController } from './debug.controller';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { AdminAssessmentController } from './admin-assessment.controller';
import { AdminAssessmentService } from './admin-assessment.service';
import { StudentAssessmentController } from './student-assessment.controller';
import { StudentAssessmentService } from './student-assessment.service';
import { SeedController } from './seed.controller';
import { AssessmentDataSeeder } from './seed-assessment-data';
import { CurriculumController } from './curriculum.controller';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { LearningPathController } from './learning-path.controller';
import { LearningPathService } from './learning-path.service';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AuthModule } from './auth/auth.module';
import { QuizModule } from './quiz.module';
import { UploadsMiddleware } from './uploads.middleware';

@Module({
  imports: [QuizModule, AuthModule],
  controllers: [
    AppController,
    DashboardController,
    ProfileController,
    ProfileApiController,
    DebugController,
    AssessmentController,
    AdminAssessmentController,
    StudentAssessmentController,
    SeedController,
    CurriculumController,
    CourseController,
    LearningPathController,
    GamificationController,
    AdminUsersController,
  ],
  providers: [
    AppService, 
    ProfilesService, 
    AssessmentService, 
    AdminAssessmentService,
    StudentAssessmentService,
    AssessmentDataSeeder,
    CourseService, 
    LearningPathService, 
    GamificationService,
    AdminUsersService
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UploadsMiddleware)
      .forRoutes('uploads');
  }
}
