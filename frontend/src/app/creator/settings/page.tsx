"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { creatorService } from "@/lib/api/creator";
import { creatorAuthService, Creator } from "@/lib/api/auth";
import { useAccount } from "wagmi";
import {
  Loader2,
  User,
  Mail,
  Building2,
  Wallet,
  Save,
  AlertTriangle,
  Trash2,
  Shield,
  Check,
  X,
} from "lucide-react";

export default function CreatorSettingsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [eoaAddress, setEoaAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    fetchCreator();
  }, []);

  useEffect(() => {
    if (creator) {
      setName(creator.name);
      setCompany(creator.company || "");
      setEoaAddress(creator.eoaAddress || "");
    }
  }, [creator]);

  const fetchCreator = async () => {
    try {
      const { creator } = await creatorService.getProfile();
      setCreator(creator);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      const { creator: updatedCreator } = await creatorService.updateProfile({
        name,
        company: company || undefined,
      });
      setCreator(updatedCreator);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWallet = async () => {
    if (!eoaAddress.trim()) return;

    setIsSaving(true);
    setError("");

    try {
      const { creator: updatedCreator } =
        await creatorService.updateEoaAddress(eoaAddress);
      setCreator(updatedCreator);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save wallet address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectWallet = () => {
    if (isConnected && address) {
      setEoaAddress(address);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await creatorService.deleteAccount();
      await creatorAuthService.logout();
      router.push("/");
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage your creator account settings
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border-2 border-red-500 text-red-400">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-green-500/20 border-2 border-green-500 text-green-400 flex items-center gap-2">
          <Check className="w-5 h-5" />
          Settings saved successfully!
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-gray-800 p-8 border-2 border-gray-600 hover:shadow-[4px_4px_0_0_#facc15] transition-shadow">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-secondary" />
          <h2 className="text-xl font-semibold text-white">Profile</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Creator Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-700 border-2 border-gray-600 text-white focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="email"
                value={creator?.email || ""}
                disabled
                className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border-2 border-gray-600 text-gray-400 cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Company/Channel Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Optional"
                className="w-full pl-12 pr-4 py-3 bg-gray-700 border-2 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-2 bg-secondary text-gray-900 px-6 py-3 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Profile
          </button>
        </div>
      </div>

      {/* Wallet Settings */}
      <div className="bg-gray-800 p-8 border-2 border-gray-600 hover:shadow-[4px_4px_0_0_#facc15] transition-shadow">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-6 h-6 text-secondary" />
          <h2 className="text-xl font-semibold text-white">Payout Wallet</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address (EOA/Smart Account)
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={eoaAddress}
                  onChange={(e) => setEoaAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-700 border-2 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-secondary focus:border-secondary font-mono text-sm"
                />
              </div>
              {isConnected && (
                <button
                  onClick={handleConnectWallet}
                  className="px-4 py-3 bg-gray-700 border-2 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-secondary transition-all"
                >
                  Use Connected
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              This is where your earnings will be sent
            </p>
          </div>

          <button
            onClick={handleSaveWallet}
            disabled={isSaving || !eoaAddress.trim()}
            className="flex items-center gap-2 bg-secondary text-gray-900 px-6 py-3 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Wallet
          </button>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-gray-800 p-8 border-2 border-gray-600">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-secondary" />
          <h2 className="text-xl font-semibold text-white">Security</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-4 border-b-2 border-gray-700">
            <div>
              <p className="font-medium text-white">Password</p>
              <p className="text-sm text-gray-500">Last changed: Never</p>
            </div>
            <button className="px-4 py-2 text-secondary border-2 border-secondary hover:shadow-[4px_4px_0_0_#facc15] transition-all">
              Change Password
            </button>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-white">
                Two-Factor Authentication
              </p>
              <p className="text-sm text-gray-500">
                Add extra security to your account
              </p>
            </div>
            <button className="px-4 py-2 text-gray-300 border-2 border-gray-600 hover:bg-gray-700 hover:border-gray-500 transition-all">
              Enable
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gray-800 p-8 border-2 border-red-500 hover:shadow-[4px_4px_0_0_#ef4444] transition-shadow">
        <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-white">Delete Account</p>
            <p className="text-sm text-gray-500">
              Permanently delete your creator account and all videos
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white border-2 border-red-600 hover:shadow-[4px_4px_0_0_#991b1b] transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 max-w-md w-full border-2 border-gray-600 shadow-[8px_8px_0_0_#facc15]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-500/20 border-2 border-red-400 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Delete Account?
                </h3>
                <p className="text-sm text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-500/20 border-2 border-red-500 text-red-400 text-sm">
                {deleteError}
              </div>
            )}

            <p className="text-gray-400 mb-6">
              All your data, videos, and earnings information will be
              permanently deleted. Any pending earnings will be lost.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:shadow-[4px_4px_0_0_#4b5563] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-500 text-white border-2 border-red-600 hover:shadow-[4px_4px_0_0_#991b1b] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
