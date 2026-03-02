#!/bin/bash
# ==============================================
# 负载均衡一键配置脚本
# ==============================================

set -e

echo "╔══════════════════════════════════════╗"
echo "║  🔄 负载均衡配置向导                 ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 检查 .env.deploy 文件
if [ ! -f .env.deploy ]; then
  echo "❌ 未找到 .env.deploy 文件"
  echo "请先创建配置文件: cp .env.deploy.example .env.deploy"
  exit 1
fi

# 加载环境变量
source .env.deploy

echo "📋 当前配置:"
echo "   ECS 地址: ${ECS_HOST}"
echo "   区域: ${ECS_REGION:-cn-shanghai}"
echo ""

# 询问用户选择
echo "请选择操作:"
echo "  1) 自动创建和配置负载均衡 (推荐)"
echo "  2) 查询现有负载均衡"
echo "  3) 仅更新部署脚本 (已有 LB)"
echo "  4) 查看配置文档"
echo ""
read -p "请输入选项 [1-4]: " choice

case $choice in
  1)
    echo ""
    echo "🚀 开始自动配置负载均衡..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # 运行自动配置脚本
    node setup-load-balancer.js

    if [ $? -eq 0 ]; then
      echo ""
      echo "✅ 负载均衡配置成功！"
      echo ""

      # 读取 LB 信息
      if [ -f .lb-info.json ]; then
        LB_ADDRESS=$(node -e "console.log(require('./.lb-info.json').address)")
        LB_ID=$(node -e "console.log(require('./.lb-info.json').id)")

        echo "📋 负载均衡信息:"
        echo "   地址: ${LB_ADDRESS}"
        echo "   ID: ${LB_ID}"
        echo ""

        # 更新 .env.deploy
        if ! grep -q "LB_ADDRESS" .env.deploy; then
          echo "export LB_ADDRESS=${LB_ADDRESS}" >> .env.deploy
          echo "export LB_ID=${LB_ID}" >> .env.deploy
          echo "export USE_LB=true" >> .env.deploy
          echo "✅ 已更新 .env.deploy"
        fi

        echo ""
        echo "💡 下一步:"
        echo "   1. 运行部署脚本: bash deploy-remote.sh"
        echo "   2. 配置域名 DNS 解析到: ${LB_ADDRESS}"
        echo "   3. (可选) 配置 HTTPS 证书"
        echo ""
      fi
    else
      echo ""
      echo "❌ 配置失败，请检查错误信息"
      exit 1
    fi
    ;;

  2)
    echo ""
    echo "🔍 查询现有负载均衡..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    node query-load-balancers.js

    echo ""
    read -p "是否要使用现有负载均衡? [y/N]: " use_existing

    if [[ $use_existing =~ ^[Yy]$ ]]; then
      read -p "请输入负载均衡 ID: " lb_id
      read -p "请输入负载均衡地址: " lb_address

      # 更新 .env.deploy
      if ! grep -q "LB_ADDRESS" .env.deploy; then
        echo "export LB_ADDRESS=${lb_address}" >> .env.deploy
        echo "export LB_ID=${lb_id}" >> .env.deploy
        echo "export USE_LB=true" >> .env.deploy
      else
        sed -i.bak "s/^export LB_ADDRESS=.*/export LB_ADDRESS=${lb_address}/" .env.deploy
        sed -i.bak "s/^export LB_ID=.*/export LB_ID=${lb_id}/" .env.deploy
      fi

      echo "✅ 配置已更新"
      echo ""
      echo "💡 下一步:"
      echo "   1. 确保负载均衡已配置监听和后端服务器"
      echo "   2. 运行部署脚本: bash deploy-remote.sh"
      echo ""
    fi
    ;;

  3)
    echo ""
    echo "📝 更新部署脚本..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ ! -f deploy-with-lb.sh ]; then
      echo "❌ 未找到 deploy-with-lb.sh"
      exit 1
    fi

    chmod +x deploy-with-lb.sh

    echo "✅ 部署脚本已准备就绪"
    echo ""
    echo "💡 使用方法:"
    echo "   本地部署: bash deploy-with-lb.sh"
    echo "   远程部署: bash deploy-remote.sh"
    echo ""
    ;;

  4)
    echo ""
    echo "📖 配置文档"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "可用文档:"
    echo "  • ARCHITECTURE.md - 架构图和说明"
    echo "  • LOAD_BALANCER_SETUP.md - 详细配置指南"
    echo "  • DEPLOY.md - 部署文档"
    echo ""

    read -p "是否打开架构文档? [y/N]: " open_doc
    if [[ $open_doc =~ ^[Yy]$ ]]; then
      if command -v cat &> /dev/null; then
        cat ARCHITECTURE.md | head -100
        echo ""
        echo "... (查看完整文档: cat ARCHITECTURE.md)"
      fi
    fi
    ;;

  *)
    echo "❌ 无效选项"
    exit 1
    ;;
esac

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ 操作完成                         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "📚 相关文档:"
echo "   • 架构图: cat ARCHITECTURE.md"
echo "   • 配置指南: cat LOAD_BALANCER_SETUP.md"
echo "   • 部署文档: cat DEPLOY.md"
echo ""
echo "💬 需要帮助?"
echo "   • 查看日志: tail -f /var/log/picshare/app.log"
echo "   • 测试健康检查: curl http://[LB-IP]/health"
echo "   • 查看服务状态: systemctl status picshare"
echo ""
