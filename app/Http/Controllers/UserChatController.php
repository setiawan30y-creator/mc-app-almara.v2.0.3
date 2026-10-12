<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Carbon\Carbon;

class UserChatController extends Controller
{
    /**
     * Get chat messages (either public or private with a specific user)
     */
    public function getMessages(Request $request)
    {
        $user = $request->user();
        $chatType = $request->query('chat_type', 'public'); // 'public' or 'private'
        $otherUserId = $request->query('other_user_id');
        $lastId = (int) $request->query('last_id', 0);

        // Update current user's last_seen_at
        if ($user) {
            $user->last_seen_at = now();
            $user->save();
        }

        $query = DB::table('mc_user_chats');

        if ($chatType === 'private') {
            if (empty($otherUserId)) {
                return response()->json(['status' => 'error', 'message' => 'other_user_id is required for private chat.'], 422);
            }
            $query->where(function($q) use ($user, $otherUserId) {
                $q->where('sender_id', $user->id)->where('receiver_id', $otherUserId);
            })->orWhere(function($q) use ($user, $otherUserId) {
                $q->where('sender_id', $otherUserId)->where('receiver_id', $user->id);
            });
        } else {
            // Public / Broadcast Group Chat
            $query->whereNull('receiver_id');
        }

        if ($lastId > 0) {
            $query->where('id', '>', $lastId);
        }

        // We fetch up to 150 messages, ordered oldest to newest for chronological chat
        $messages = $query->orderBy('created_at', 'asc')->limit(150)->get();

        // Map sender details
        $messages = $messages->map(function($m) {
            $sender = User::find($m->sender_id);
            $m->sender_name = $sender ? ($sender->full_name ?: $sender->username) : 'Sistem';
            $m->sender_photo = $sender ? ($sender->photo ?: '') : '';
            return $m;
        });

        // Mark incoming private messages as read
        if ($chatType === 'private' && $otherUserId) {
            DB::table('mc_user_chats')
                ->where('sender_id', $otherUserId)
                ->where('receiver_id', $user->id)
                ->where('is_read', false)
                ->update(['is_read' => true]);
        }

        return response()->json([
            'status' => 'success',
            'data' => $messages
        ]);
    }

    /**
     * Send a new message
     */
    public function sendMessage(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'message' => 'nullable|string',
            'receiver_id' => 'nullable|string|exists:users,id',
            'attachment_data' => 'nullable|string',
            'attachment_name' => 'nullable|string|max:180',
            'attachment_mime' => 'nullable|string|max:120',
            'attachment_size' => 'nullable|integer',
        ]);

        $receiverId = $request->input('receiver_id');
        $messageText = trim((string) $request->input('message', ''));
        $attachment = $this->storeChatAttachment($request);

        if ($messageText === '' && !$attachment) {
            return response()->json(['status' => 'error', 'message' => 'Pesan atau lampiran wajib diisi.'], 422);
        }

        if ($messageText === '' && $attachment) {
            $messageText = $attachment['is_image'] ? 'Mengirim gambar' : 'Mengirim file';
        }

        $insertData = [
            'sender_id' => $user->id,
            'receiver_id' => $receiverId,
            'message' => $messageText,
            'is_read' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if ($attachment && Schema::hasColumn('mc_user_chats', 'attachment_path')) {
            $insertData['attachment_path'] = $attachment['path'];
            $insertData['attachment_name'] = $attachment['name'];
            $insertData['attachment_mime'] = $attachment['mime'];
            $insertData['attachment_size'] = $attachment['size'];
        }

        $id = DB::table('mc_user_chats')->insertGetId($insertData);

        // Fetch the inserted message object
        $message = DB::table('mc_user_chats')->where('id', $id)->first();
        if ($message) {
            $message->sender_name = $user->full_name ?: $user->username;
            $message->sender_photo = $user->photo ?: '';
        }

        // Update current user's last_seen_at
        if ($user) {
            $user->last_seen_at = now();
            $user->save();
        }

        return response()->json([
            'status' => 'success',
            'data' => $message
        ]);
    }

    private function storeChatAttachment(Request $request): ?array
    {
        $dataUrl = $request->input('attachment_data');
        if (!$dataUrl) {
            return null;
        }

        if (!preg_match('/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i', $dataUrl, $matches)) {
            throw new HttpResponseException(response()->json(['status' => 'error', 'message' => 'Format lampiran chat tidak valid.'], 422));
        }

        $mime = strtolower($matches[1]);
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'application/pdf' => 'pdf',
            'text/plain' => 'txt',
            'application/zip' => 'zip',
            'application/x-zip-compressed' => 'zip',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/vnd.ms-powerpoint' => 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        ];

        if (!isset($extensions[$mime])) {
            throw new HttpResponseException(response()->json(['status' => 'error', 'message' => 'Tipe file chat tidak didukung.'], 422));
        }

        $binary = base64_decode($matches[2], true);
        if ($binary === false) {
            throw new HttpResponseException(response()->json(['status' => 'error', 'message' => 'Lampiran chat gagal dibaca.'], 422));
        }

        if (strlen($binary) > 10 * 1024 * 1024) {
            throw new HttpResponseException(response()->json(['status' => 'error', 'message' => 'Ukuran lampiran chat maksimal 10 MB.'], 413));
        }

        $directory = public_path('uploads/user-chat');
        if (!File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }

        $originalName = pathinfo($request->input('attachment_name', 'lampiran-chat'), PATHINFO_FILENAME);
        $safeName = Str::slug($originalName) ?: 'lampiran-chat';
        $filename = $safeName . '-' . now()->format('YmdHis') . '-' . Str::random(6) . '.' . $extensions[$mime];

        File::put($directory . DIRECTORY_SEPARATOR . $filename, $binary);

        return [
            'path' => '/uploads/user-chat/' . $filename,
            'name' => $request->input('attachment_name') ?: $filename,
            'mime' => $mime,
            'size' => strlen($binary),
            'is_image' => Str::startsWith($mime, 'image/'),
        ];
    }

    /**
     * Get all users with their online status and unread private message counts
     */
    public function getChatUsers(Request $request)
    {
        $user = $request->user();

        // Update current user's last_seen_at
        if ($user) {
            $user->last_seen_at = now();
            $user->save();
        }

        // Get all users except currently logged in user
        $users = User::where('id', '!=', $user->id)
            ->orderBy('username')
            ->get();

        $data = $users->map(function ($u) use ($user) {
            // Count unread messages from this specific sender to the current user
            $unreadCount = DB::table('mc_user_chats')
                ->where('sender_id', $u->id)
                ->where('receiver_id', $user->id)
                ->where('is_read', false)
                ->count();

            // Online status: active in last 15 seconds
            $isOnline = false;
            if ($u->last_seen_at) {
                $isOnline = Carbon::parse($u->last_seen_at)->diffInSeconds(now()) < 15;
            }

            return [
                'id' => $u->id,
                'username' => $u->username,
                'fullName' => $u->full_name ?: $u->username,
                'role' => strtolower($u->role ?: 'kasir'),
                'photo' => $u->photo ?: '',
                'unreadCount' => $unreadCount,
                'isOnline' => $isOnline,
                'lastSeen' => $u->last_seen_at ? Carbon::parse($u->last_seen_at)->toISOString() : null
            ];
        });

        // Also fetch total unread private messages across all senders
        $totalUnreadPrivate = DB::table('mc_user_chats')
            ->where('receiver_id', $user->id)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'status' => 'success',
            'data' => $data,
            'totalUnreadPrivate' => $totalUnreadPrivate
        ]);
    }

    /**
     * Real-time polling endpoint for detecting new messages sent by other users
     */
    public function pollNewMessages(Request $request)
    {
        $user = $request->user();
        $lastId = (int) $request->query('last_id', 0);

        // Update current user's last_seen_at
        if ($user) {
            $user->last_seen_at = now();
            $user->save();
        }

        // Fetch any message with ID > lastId that was NOT sent by the current user
        // and is EITHER broadcast/public (receiver_id is null) OR addressed to current user
        $newMessages = DB::table('mc_user_chats')
            ->where('id', '>', $lastId)
            ->where('sender_id', '!=', $user->id)
            ->where(function($q) use ($user) {
                $q->where('receiver_id', $user->id)
                  ->orWhereNull('receiver_id');
            })
            ->orderBy('id', 'asc')
            ->get();

        // Append sender meta data to the messages
        $newMessages = $newMessages->map(function($m) {
            $sender = User::find($m->sender_id);
            $m->sender_name = $sender ? ($sender->full_name ?: $sender->username) : 'Sistem';
            $m->sender_photo = $sender ? ($sender->photo ?: '') : '';
            return $m;
        });

        return response()->json([
            'status' => 'success',
            'data' => $newMessages
        ]);
    }
}
