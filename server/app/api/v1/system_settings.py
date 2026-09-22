from fastapi import APIRouter

from app.core.permissions import DbSession, SuperAdmin
from app.domain.enums import WebhookPlatform
from app.schemas import (
    ImageAccelerationSettingsRead,
    MiniProgramFeaturesRead,
    WebhookChannelRead,
    WebhookChannelUpdate,
    WebhookTestRead,
    WebhookTestRequest,
)
from app.services import ai_search_service, webhook_service

router = APIRouter(prefix="/system-settings", tags=["系统设置"])


@router.get(
    "/image-acceleration",
    response_model=ImageAccelerationSettingsRead,
    summary="图片加速设置",
)
async def image_acceleration_settings(session: DbSession) -> ImageAccelerationSettingsRead:
    # 公开配置端点：同时服务管理端（Bearer 管理端 token）与小程序（Bearer 小程序 token），
    # 两种鉴权体系不同，故保持匿名。仅返回一个图片加速 URL，泄露价值低。
    server_url = await ai_search_service.get_image_acceleration_server_url(session)
    return ImageAccelerationSettingsRead(image_acceleration_server_url=server_url)


@router.get(
    "/mini-program-features",
    response_model=MiniProgramFeaturesRead,
    summary="功能开关配置",
)
async def mini_program_features(session: DbSession) -> MiniProgramFeaturesRead:
    # 公开配置端点：下发小程序功能档位（禁用/仅查询/可读写）与后台主 tab 可见性，泄露价值低。
    # 前端在 mount 前拉取一次：菜单与路由落地页都按它渲染。
    # 开关只用于前端拦截展示与跳转，后端数据接口不做对应鉴权（见 README）；
    # 后台可见性同理——隐藏的主 tab 仍可用链接直达，系统管理不参与开关。
    return await ai_search_service.get_mini_program_features(session)


@router.get(
    "/webhooks",
    response_model=list[WebhookChannelRead],
    summary="Webhook 配置",
)
async def webhook_channels(session: DbSession, user: SuperAdmin) -> list[WebhookChannelRead]:
    return await webhook_service.list_channels(session)


@router.put(
    "/webhooks/{platform}",
    response_model=WebhookChannelRead,
    summary="保存 Webhook 配置",
)
async def update_webhook_channel(
    platform: WebhookPlatform,
    data: WebhookChannelUpdate,
    session: DbSession,
    user: SuperAdmin,
) -> WebhookChannelRead:
    channel = await webhook_service.update_channel(session, platform, data)
    return webhook_service.channel_read(channel, platform)


@router.post(
    "/webhooks/{platform}/test",
    response_model=WebhookTestRead,
    summary="测试 Webhook",
)
async def test_webhook_channel(
    platform: WebhookPlatform,
    data: WebhookTestRequest,
    user: SuperAdmin,
) -> WebhookTestRead:
    await webhook_service.test_channel(platform, data)
    return WebhookTestRead(platform=platform, success=True, message="测试消息已发送")
