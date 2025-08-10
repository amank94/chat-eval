# Deployment Guide for Chat Eval Application

## Deploying to Render.com

### Prerequisites
1. A Render.com account
2. GitHub repository with the application code
3. Anthropic API key

### Deployment Steps

#### 1. Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial deployment setup"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

#### 2. Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `chat-eval`
   - **Runtime**: Python
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn app:app --config gunicorn.conf.py`

#### 3. Configure Environment Variables

In Render dashboard, add these environment variables:
- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `SECRET_KEY`: A random secret key for Flask sessions
- `FLASK_ENV`: Set to `production`
- `DATABASE_URL`: Will be auto-set if you add PostgreSQL

#### 4. Add PostgreSQL Database (Optional but Recommended)

1. In Render dashboard, click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `chateval-db`
   - **Plan**: Free tier is fine for starting
3. Once created, it will automatically set `DATABASE_URL` in your web service

#### 5. Add Redis (Optional)

1. In Render dashboard, click "New +" → "Redis"
2. Configure:
   - **Name**: `chateval-redis`
   - **Plan**: Free tier
3. Copy the connection URL and add it as `REDIS_URL` environment variable

### Using render.yaml (Alternative Method)

Instead of manual configuration, you can use the `render.yaml` file:

1. Push the `render.yaml` file to your repository
2. In Render dashboard, click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically create all services defined in `render.yaml`

### Manual Deployment Commands

If you prefer manual deployment:

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export ANTHROPIC_API_KEY="your-key-here"
export FLASK_ENV="production"
export SECRET_KEY="your-secret-key"

# Run with gunicorn
gunicorn app:app --config gunicorn.conf.py
```

### Health Check

The application includes a health check endpoint at `/health` that Render will use to monitor the application status.

### Database Migrations

If using PostgreSQL, initialize the database:

```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

### Monitoring

- Check application logs in Render dashboard
- Monitor the `/health` endpoint for service status
- Database and Redis status are included in health check response

### Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI responses | Yes | - |
| `SECRET_KEY` | Flask session secret key | Yes | dev-secret-key |
| `DATABASE_URL` | PostgreSQL connection string | No | sqlite:///chateval.db |
| `REDIS_URL` | Redis connection string | No | - |
| `FLASK_ENV` | Flask environment (development/production) | No | development |
| `PORT` | Port number for the server | No | 5000 |

### Troubleshooting

1. **Application won't start**: Check logs in Render dashboard
2. **Database connection errors**: Verify DATABASE_URL is set correctly
3. **API errors**: Ensure ANTHROPIC_API_KEY is valid
4. **Health check failing**: Check `/health` endpoint manually

### Security Notes

- Never commit `.env` files with real API keys
- Use Render's environment variables for sensitive data
- Enable HTTPS (automatic on Render)
- Consider adding rate limiting for production use

### Performance Optimization

The deployment is configured with:
- Gunicorn workers based on CPU count
- Request timeout of 120 seconds
- Worker recycling after 1000 requests
- PostgreSQL for persistent storage
- Redis for session caching (optional)

### Scaling

To scale the application:
1. Upgrade Render plan for more resources
2. Increase worker count in `gunicorn.conf.py`
3. Consider adding a CDN for static files
4. Implement caching strategies

### Support

For issues:
1. Check Render documentation: https://render.com/docs
2. Review application logs
3. Test locally with production settings
4. Check health endpoint: `https://your-app.onrender.com/health`