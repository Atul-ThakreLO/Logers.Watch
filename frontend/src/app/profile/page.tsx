"use client";

import { useState, useEffect } from "react";
import { userService } from "@/lib/api/user";
import { billingService } from "@/lib/api/billing";
import { User } from "@/lib/api/auth";
import {
  Loader2,
  User as UserIcon,
  Mail,
  Calendar,
  Wallet,
  Edit2,
  Save,
  X,
} from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      // Best-effort sync so profile balance and last recharge reflect latest on-chain deposit.
      try {
        await billingService.syncBalance();
      } catch {
        // Ignore when wallet is not linked or no new deposit exists.
      }

      const { user } = await userService.getProfile();
      setUser(user);
      setEditName(user.name);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      const { user: updatedUser } = await userService.updateProfile({
        name: editName,
      });
      setUser(updatedUser);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(user?.name || "");
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white border-2 border-black p-8 flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border-2 border-black p-8">
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={fetchProfile}
            className="mt-4 text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white border-2 border-black p-8 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-primary/10 border-2 border-black flex items-center justify-center">
              <UserIcon className="w-12 h-12 text-primary" />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-primary focus:outline-none bg-transparent"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-2 text-green-500 hover:bg-green-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 text-red-500 hover:bg-red-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user?.name}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-gray-500 flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 border-2 border-green-600 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${user?.balance?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 border-2 border-blue-600 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Recharge</p>
              <p className="text-2xl font-bold text-gray-900">
                ${user?.lastRechargeAmount?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-6 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 border-2 border-purple-600 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-lg font-bold text-gray-900">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white border-2 border-black p-8 hover:shadow-[4px_4px_0_0_#000] transition-shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Account Information
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between py-3 border-b-2 border-gray-200">
            <span className="text-gray-500">User ID</span>
            <span className="text-gray-900 font-mono text-sm">{user?.id}</span>
          </div>
          <div className="flex justify-between py-3 border-b-2 border-gray-200">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900">{user?.email}</span>
          </div>
          <div className="flex justify-between py-3 border-b-2 border-gray-200">
            <span className="text-gray-500">Account Status</span>
            <span className="px-3 py-1 bg-green-100 text-green-700 border-2 border-green-600 text-sm font-medium">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
