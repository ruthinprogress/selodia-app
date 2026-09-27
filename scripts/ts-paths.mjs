// Register the resolve hook. Use with:  node --import ./scripts/ts-paths.mjs <script>
import { register } from 'node:module';

register('./ts-paths-hooks.mjs', import.meta.url);
