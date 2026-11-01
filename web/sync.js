import { createClient } from './supabase-sdk.js';
import { supabaseUrl, supabasePublishableKey } from './supabase-config.js';

export const cloud = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export async function signUp(email, password) {
  const { data, error } = await cloud.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await cloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function getGroups() {
  const membership = await cloud.from('group_members').select('group_id');
  if (membership.error) throw membership.error;
  const ids = membership.data.map((row) => row.group_id);
  if (!ids.length) return [];
  const groups = await cloud.from('friend_groups').select('id,name').in('id', ids);
  if (groups.error) throw groups.error;
  return groups.data;
}

async function rpc(name, args) {
  const { data, error } = await cloud.rpc(name, args);
  if (error) throw error;
  return data;
}

export const createInvite = (groupId) => rpc('create_group_invite', { p_group_id: groupId });
export const joinByCode = (code) => rpc('join_group_by_code', { p_code: code });
export const getMembers = (groupId) => rpc('list_group_members', { p_group_id: groupId });

export async function setMemberName(groupId, userId, displayName) {
  const { error } = await cloud.from('group_members').update({ display_name: displayName })
    .eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

export async function leaveGroup(groupId, userId) {
  const { error } = await cloud.from('group_members').delete()
    .eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

export async function pushRating(rating, groupId, userId, authorName) {
  const row = {
    id: rating.id,
    group_id: groupId,
    user_id: userId,
    author_name: authorName,
    cocktail_id: rating.cocktailId,
    liked: rating.liked,
    variant: rating.variant,
    sweetness: rating.sweetness,
    fruitiness: rating.fruitiness,
    sourness: rating.sourness,
    note: rating.note,
    created_at: rating.createdAt,
    updated_at: rating.updatedAt,
  };
  const { error } = await cloud.from('drink_ratings').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function pullRatings(groupId) {
  const results = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await cloud.from('drink_ratings')
      .select('id,group_id,user_id,author_name,cocktail_id,liked,variant,sweetness,fruitiness,sourness,note,created_at,updated_at')
      .eq('group_id', groupId).is('deleted_at', null)
      .order('created_at', { ascending: false }).range(offset, offset + 499);
    if (error) throw error;
    results.push(...data);
    if (data.length < 500) return results;
  }
}
