/** @jsxImportSource preact */
import type { HealthChecks } from '../../types';
import { ConfigItem } from './Admin.utils';

interface PlatformConfigCardProps {
    title: string;
    iconColor: string;
    icon: string;
    statusActive: boolean;
    statusText: string;
    items: Array<{ label: string; active: boolean }>;
}

export function PlatformConfigCard({ title, iconColor, icon, statusActive, statusText, items }: PlatformConfigCardProps) {
    return (
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">
                    <span style={{ color: iconColor }}>{icon}</span> {title}
                </h3>
                <span class={`status-tag ${statusActive ? 'active' : 'inactive'}`}>
                    {statusText}
                </span>
            </div>
            <div class="config-list">
                {items.map((item, idx) => (
                    <ConfigItem key={idx} label={item.label} active={item.active} />
                ))}
            </div>
        </div>
    );
}
