import { ACCEPTANCE_SCENES, describeScene } from './examples';

for (const build of ACCEPTANCE_SCENES) {
  console.log(describeScene(build()));
}
