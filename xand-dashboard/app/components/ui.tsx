"use client";

import { ReactNode, useMemo } from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

// Mini sparkline chart component for CPU trends
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export function Sparkline({ 
  data, 
  width = 80, 
  height = 24, 
  color = "#10b981",
  fillColor = "rgba(16, 185, 129, 0.1)"
}: SparklineProps) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return "";
    
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M${points.join(" L")}`;
  }, [data, width, height]);

  const fillPath = useMemo(() => {
    if (!data || data.length < 2) return "";
    
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M0,${height} L${points.join(" L")} L${width},${height} Z`;
  }, [data, width, height]);

  // Determine color based on trend (last value vs first)
  const trendColor = useMemo(() => {
    if (!data || data.length < 2) return color;
    const trend = data[data.length - 1] - data[0];
    // For CPU: higher is worse (red), lower is better (green)
    return trend > 5 ? "#ef4444" : trend < -5 ? "#10b981" : "#f59e0b";
  }, [data, color]);

  const trendFill = useMemo(() => {
    if (!data || data.length < 2) return fillColor;
    const trend = data[data.length - 1] - data[0];
    return trend > 5 ? "rgba(239, 68, 68, 0.1)" : trend < -5 ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)";
  }, [data, fillColor]);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <span className="text-xs text-gray-400">—</span>
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={fillPath} fill={trendFill} />
      <path 
        d={path} 
        fill="none" 
        stroke={trendColor} 
        strokeWidth={1.5} 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: "blue" | "green" | "purple" | "orange" | "red" | "teal";
}

const colorClasses = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  purple: "bg-purple-50 text-purple-600",
  orange: "bg-orange-50 text-orange-600",
  red: "bg-red-50 text-red-600",
  teal: "bg-teal-50 text-teal-600",
};

export function StatCard({ title, value, icon: Icon, subtext, trend, color = "blue" }: StatCardProps) {
  return (
    <div className="bg-white p-6 border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500">{title}</p>
          <h3 className="text-2xl font-mono font-medium text-gray-900 mt-2">{value}</h3>
          {subtext && <p className="text-xs font-mono text-gray-400 mt-1">{subtext}</p>}
          {trend && (
            <p className={`text-xs font-mono mt-2 flex items-center gap-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? <TrendingUp className="w-3 h-3" strokeWidth={1.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={1.5} />}
              {trend.value}
            </p>
          )}
        </div>
        <div className="p-2 bg-gray-50">
          <Icon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

interface NetworkScoreProps {
  score: number;
  onlinePercent: number;
}

export function NetworkScore({ score, onlinePercent }: NetworkScoreProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-blue-500";
    if (s >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    if (s >= 40) return "Fair";
    return "Needs Attention";
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Network Score</h3>
        <span className={`text-xs px-2 py-1 rounded-full bg-white/10 ${getScoreColor(score)}`}>
          {getScoreLabel(score)}
        </span>
      </div>
      
      <div className="flex items-end gap-4">
        <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {score}
        </div>
        <div className="text-gray-400 mb-1">/100</div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Nodes Online</span>
          <span className="font-medium">{onlinePercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(onlinePercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface HealthBadgeProps {
  score: number;
  size?: "sm" | "md";
}

export function HealthBadge({ score, size = "sm" }: HealthBadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  
  if (score >= 80) {
    return (
      <span className={`${sizeClasses} rounded-full bg-green-100 text-green-700 font-medium`}>
        Excellent
      </span>
    );
  } else if (score >= 60) {
    return (
      <span className={`${sizeClasses} rounded-full bg-blue-100 text-blue-700 font-medium`}>
        Good
      </span>
    );
  } else if (score >= 40) {
    return (
      <span className={`${sizeClasses} rounded-full bg-yellow-100 text-yellow-700 font-medium`}>
        Fair
      </span>
    );
  } else {
    return (
      <span className={`${sizeClasses} rounded-full bg-red-100 text-red-700 font-medium`}>
        Poor
      </span>
    );
  }
}

interface StatusBadgeProps {
  status: "Online" | "Offline" | "Unknown";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "Online":
      return (
        <span className="flex items-center gap-1.5 text-green-600 font-medium text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Online
        </span>
      );
    case "Offline":
      return (
        <span className="flex items-center gap-1.5 text-red-600 font-medium text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Offline
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1.5 text-gray-500 font-medium text-sm">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          Unknown
        </span>
      );
  }
}

interface MetricBarProps {
  value: number;
  label: string;
  showValue?: boolean;
}

export function MetricBar({ value, label, showValue = true }: MetricBarProps) {
  const getColor = (val: number) => {
    if (val >= 90) return "bg-red-500";
    if (val >= 70) return "bg-orange-500";
    if (val >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        {showValue && <span className="font-medium text-gray-900">{value.toFixed(1)}%</span>}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div 
          className={`${getColor(value)} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export function LoadingSpinner({ size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-8 w-8 border-2",
    md: "h-12 w-12 border-4",
    lg: "h-16 w-16 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`animate-spin rounded-full border-blue-600 border-t-transparent ${sizeClasses[size]}`} />
      {text && <p className="text-gray-600 font-medium">{text}</p>}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 bg-gray-100 rounded-full mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
