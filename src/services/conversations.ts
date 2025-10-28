import { supabase } from './supabase';
import { Conversation } from '../types';

/**
 * Get or create a conversation between two users
 */
export async function getOrCreateConversation(
  userAId: string,
  userBId: string
): Promise<Conversation> {
  try {
    // Debug: log current auth user and IDs being inserted
    const authUser = await supabase.auth.getUser();
    console.log('[DEBUG] Supabase auth user:', authUser?.data?.user?.id);
    console.log('[DEBUG] getOrCreateConversation userAId:', userAId, 'userBId:', userBId);
    // Normalize user IDs to enforce unique constraint
    const minId = userAId < userBId ? userAId : userBId;
    const maxId = userAId < userBId ? userBId : userAId;

    // Check if conversation exists
    const { data: existing, error: selectError } = await supabase
      .from('conversations')
      .select('*')
      .or(
        `and(user_a.eq.${minId},user_b.eq.${maxId}),and(user_a.eq.${maxId},user_b.eq.${minId})`
      )
      .single();

    if (existing) {
      return existing;
    }

    // Create new conversation
    const { data: newConv, error: insertError } = await supabase
      .from('conversations')
      .insert({
        user_a: minId,
        user_b: maxId,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return newConv;
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    throw error;
  }
}

/**
 * Update conversation's last message timestamp
 */
export async function updateConversationTimestamp(
  conversationId: string
): Promise<void> {
  try {
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  } catch (error) {
    console.error('Error updating conversation timestamp:', error);
  }
}
