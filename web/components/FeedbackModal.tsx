"use client";

import { useState } from "react";
import { X, Send, Mail, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus("idle");

        try {
            const response = await fetch("/api/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    email,
                    message,
                }),
            });

            if (response.ok) {
                setSubmitStatus("success");
                setName("");
                setEmail("");
                setMessage("");
                setTimeout(() => {
                    onClose();
                    setSubmitStatus("idle");
                }, 2000);
            } else {
                setSubmitStatus("error");
            }
        } catch (error) {
            console.error("Error submitting feedback:", error);
            setSubmitStatus("error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            {t("Send Feedback")}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t("We'd love to hear your thoughts, suggestions, or issues you've encountered.")}
                    </p>

                    {/* Name Field */}
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                        >
                            {t("Name")}
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
                            placeholder={t("Your name")}
                        />
                    </div>

                    {/* Email Field */}
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                        >
                            {t("Email")}
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
                                placeholder="your@email.com"
                            />
                        </div>
                    </div>

                    {/* Message Field */}
                    <div>
                        <label
                            htmlFor="message"
                            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                        >
                            {t("Message")}
                        </label>
                        <textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            rows={5}
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all resize-none"
                            placeholder={t("Tell us what you think...")}
                        />
                    </div>

                    {/* Status Messages */}
                    {submitStatus === "success" && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-300 text-sm">
                            ✓ {t("Thank you! Your feedback has been sent successfully.")}
                        </div>
                    )}

                    {submitStatus === "error" && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300 text-sm">
                            ✗ {t("Failed to send feedback. Please try again.")}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-blue-800 text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                {t("Sending...")}
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                {t("Send Feedback")}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
