import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";
import { customerRouteRedirect } from "@/lib/customer-mode";

function GuardedUserLayout() {
    const { pathname } = useLocation();
    const redirectPath = customerRouteRedirect(pathname);
    if (redirectPath) return <Navigate to={redirectPath} replace />;
    return (
        <UserLayout>
            <AnalyticsTracker />
            <Outlet />
        </UserLayout>
    );
}

function GuardedNotFound() {
    const { pathname } = useLocation();
    const redirectPath = customerRouteRedirect(pathname);
    return redirectPath ? <Navigate to={redirectPath} replace /> : <NotFound />;
}

export const router = createBrowserRouter([
    {
        element: <GuardedUserLayout />,
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/image", element: <ImagePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/prompts", element: <PromptsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <ConfigPage /> },
        ],
    },
    { path: "*", element: <GuardedNotFound /> },
]);
