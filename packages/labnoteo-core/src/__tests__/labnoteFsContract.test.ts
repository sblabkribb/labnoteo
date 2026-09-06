import { MemFileSystem } from '../fs/memFileSystem';
import { runLabnoteFsContract } from './labnoteFsContract';

// Applies the shared LabnoteFs contract to the in-memory implementation. Once
// the Phase 3 Vault API rewrite lands, the plugin package will run the same
// `runLabnoteFsContract` against `VaultFileSystem` under an `obsidian` mock.
runLabnoteFsContract('MemFileSystem', () => new MemFileSystem());
