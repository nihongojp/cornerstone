import * as migration_20260815_071846_initial_content_model from './20260815_071846_initial_content_model';
import * as migration_20260815_090103_lesson_format from './20260815_090103_lesson_format';
import * as migration_20260815_120000_user_progress_lesson_fk from './20260815_120000_user_progress_lesson_fk';

export const migrations = [
  {
    up: migration_20260815_071846_initial_content_model.up,
    down: migration_20260815_071846_initial_content_model.down,
    name: '20260815_071846_initial_content_model',
  },
  {
    up: migration_20260815_090103_lesson_format.up,
    down: migration_20260815_090103_lesson_format.down,
    name: '20260815_090103_lesson_format'
  },
  {
    up: migration_20260815_120000_user_progress_lesson_fk.up,
    down: migration_20260815_120000_user_progress_lesson_fk.down,
    name: '20260815_120000_user_progress_lesson_fk'
  },
];
