import { supabase } from './supabase';

/**
 * Permanently delete all data associated with a user:
 * - messages in conversations where the user participates
 * - conversations involving the user
 * - gallery items and storage objects for the user
 * - user profile row (optional)
 *
 * NOTE: This relies on RLS allowing the user to delete their own data.
 * This does NOT delete other users' data.
 */
export async function wipeAllUserData(userId: string): Promise<void> {
  // Delete gallery files and rows
  try {
    const { data: galleryItems } = await supabase
      .from('galleries')
      .select('id, file_path')
      .or(`owner_a.eq.${userId},owner_b.eq.${userId}`);

    const paths = (galleryItems || []).map((g) => g.file_path);
    if (paths.length) {
      // Delete from storage (best-effort)
      await supabase.storage.from('message-media').remove(paths);
    }
    // Delete gallery rows
    await supabase
      .from('galleries')
      .delete()
      .or(`owner_a.eq.${userId},owner_b.eq.${userId}`);
  } catch (e) {
    console.warn('wipeAllUserData galleries error', e);
  }

  // Delete messages and conversations
  try {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    const convIds = (convs || []).map((c) => c.id);
    if (convIds.length) {
      // Delete messages
      await supabase
        .from('messages')
        .delete()
        .in('conversation_id', convIds);
      // Delete conversations
      await supabase
        .from('conversations')
        .delete()
        .in('id', convIds);
    }
  } catch (e) {
    console.warn('wipeAllUserData conversations error', e);
  }

  // Optionally delete user profile
  try {
    await supabase
      .from('users')
      .delete()
      .eq('id', userId);
  } catch (e) {
    console.warn('wipeAllUserData user delete error', e);
  }
}
