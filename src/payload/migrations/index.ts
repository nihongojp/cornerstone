import * as migration_20260815_071846_initial_content_model from './20260815_071846_initial_content_model';

export const migrations = [
  {
    up: migration_20260815_071846_initial_content_model.up,
    down: migration_20260815_071846_initial_content_model.down,
    name: '20260815_071846_initial_content_model'
  },
];
