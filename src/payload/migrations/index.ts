import * as migration_20260815_071846_initial_content_model from './20260815_071846_initial_content_model';
import * as migration_20260815_090103_lesson_format from './20260815_090103_lesson_format';
import * as migration_20260815_120000_user_progress_lesson_fk from './20260815_120000_user_progress_lesson_fk';
import * as migration_20260817_100401_media_upload_relationships from './20260817_100401_media_upload_relationships';
import * as migration_20260817_103837_terms_collection from './20260817_103837_terms_collection';
import * as migration_20260817_123651_richtext_prose from './20260817_123651_richtext_prose';
import * as migration_20260817_140611_block_library from './20260817_140611_block_library';
import * as migration_20260817_143501_dialogue_block from './20260817_143501_dialogue_block';
import * as migration_20260817_214000_phase4b_spotlight_layout from './20260817_214000_phase4b_spotlight_layout';
import * as migration_20260817_223731_phase5_autosave_roles from './20260817_223731_phase5_autosave_roles';
import * as migration_20260818_000000_phase4b_drop_old_blocks from './20260818_000000_phase4b_drop_old_blocks';
import * as migration_20260819_110607_content_model_steps_level_part from './20260819_110607_content_model_steps_level_part';

export const migrations = [
  {
    up: migration_20260815_071846_initial_content_model.up,
    down: migration_20260815_071846_initial_content_model.down,
    name: '20260815_071846_initial_content_model',
  },
  {
    up: migration_20260815_090103_lesson_format.up,
    down: migration_20260815_090103_lesson_format.down,
    name: '20260815_090103_lesson_format',
  },
  {
    up: migration_20260815_120000_user_progress_lesson_fk.up,
    down: migration_20260815_120000_user_progress_lesson_fk.down,
    name: '20260815_120000_user_progress_lesson_fk',
  },
  {
    up: migration_20260817_100401_media_upload_relationships.up,
    down: migration_20260817_100401_media_upload_relationships.down,
    name: '20260817_100401_media_upload_relationships',
  },
  {
    up: migration_20260817_103837_terms_collection.up,
    down: migration_20260817_103837_terms_collection.down,
    name: '20260817_103837_terms_collection',
  },
  {
    up: migration_20260817_123651_richtext_prose.up,
    down: migration_20260817_123651_richtext_prose.down,
    name: '20260817_123651_richtext_prose',
  },
  {
    up: migration_20260817_140611_block_library.up,
    down: migration_20260817_140611_block_library.down,
    name: '20260817_140611_block_library',
  },
  {
    up: migration_20260817_143501_dialogue_block.up,
    down: migration_20260817_143501_dialogue_block.down,
    name: '20260817_143501_dialogue_block',
  },
  {
    up: migration_20260817_214000_phase4b_spotlight_layout.up,
    down: migration_20260817_214000_phase4b_spotlight_layout.down,
    name: '20260817_214000_phase4b_spotlight_layout',
  },
  {
    up: migration_20260817_223731_phase5_autosave_roles.up,
    down: migration_20260817_223731_phase5_autosave_roles.down,
    name: '20260817_223731_phase5_autosave_roles',
  },
  {
    up: migration_20260818_000000_phase4b_drop_old_blocks.up,
    down: migration_20260818_000000_phase4b_drop_old_blocks.down,
    name: '20260818_000000_phase4b_drop_old_blocks',
  },
  {
    up: migration_20260819_110607_content_model_steps_level_part.up,
    down: migration_20260819_110607_content_model_steps_level_part.down,
    name: '20260819_110607_content_model_steps_level_part'
  },
];
