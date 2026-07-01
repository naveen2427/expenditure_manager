import os
import mysql.connector
from mysql.connector import Error as MySQLError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Check if we should connect to PostgreSQL (Render production) or MySQL (local dev)
DATABASE_URL = os.environ.get("DATABASE_URL")
IS_POSTGRES = DATABASE_URL is not None

if IS_POSTGRES:
    import psycopg2
    import psycopg2.extras

# Local MySQL connection details
MYSQL_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "password"
}
DB_NAME = "personal_finance_db"

mysql_pool = None

def get_connection(include_db=True):
    """Get a database connection (PostgreSQL or MySQL) depending on environment."""
    global mysql_pool
    
    if IS_POSTGRES:
        try:
            # Connect to PostgreSQL directly using DATABASE_URL
            return psycopg2.connect(DATABASE_URL)
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise e
    else:
        # Local MySQL pooling
        config = MYSQL_CONFIG.copy()
        if include_db:
            config["database"] = DB_NAME
            
        try:
            if include_db:
                if mysql_pool is None:
                    mysql_pool = mysql.connector.pooling.MySQLConnectionPool(
                        pool_name="finance_pool",
                        pool_size=5,
                        **config
                    )
                return mysql_pool.get_connection()
            else:
                return mysql.connector.connect(**config)
        except MySQLError as e:
            logger.error(f"Error connecting to MySQL: {e}")
            raise e

def init_db():
    """Create database, tables, and seed initial data if they don't exist."""
    if IS_POSTGRES:
        init_postgres_db()
    else:
        init_mysql_db()

def init_postgres_db():
    """Initialize PostgreSQL database structure (Render environment)."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Create tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                token VARCHAR(64) PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                color VARCHAR(20) DEFAULT '#cccccc',
                CONSTRAINT unique_category_name_per_user UNIQUE (name, type, user_id)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                category_id INT REFERENCES categories(id) ON DELETE SET NULL,
                type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
                amount DECIMAL(12, 2) NOT NULL,
                description VARCHAR(255) NULL,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()
        logger.info("PostgreSQL tables verified/created.")
        
        # Seed default user with ID 1
        cursor.execute("""
            INSERT INTO users (id, username, email, password_hash)
            VALUES (1, 'default', 'default@example.com', 'default')
            ON CONFLICT (id) DO NOTHING;
        """)
        conn.commit()
        
        # 2. Seed default categories
        default_categories = [
            ("Salary", "income", "#10B981"),
            ("Freelance", "income", "#34D399"),
            ("Investment", "income", "#6EE7B7"),
            ("Gifts", "income", "#A7F3D0"),
            ("Other Income", "income", "#059669"),
            ("Housing", "expense", "#EF4444"),
            ("Food & Groceries", "expense", "#F59E0B"),
            ("Utilities", "expense", "#3B82F6"),
            ("Transportation", "expense", "#EC4899"),
            ("Entertainment", "expense", "#8B5CF6"),
            ("Shopping", "expense", "#D946EF"),
            ("Healthcare", "expense", "#10B981"),
            ("Education", "expense", "#6366F1"),
            ("Other Expense", "expense", "#6B7280"),
        ]
        
        for name, cat_type, color in default_categories:
            try:
                cursor.execute(
                    "INSERT INTO categories (name, type, user_id, color) VALUES (%s, %s, NULL, %s) ON CONFLICT (name, type, user_id) DO NOTHING",
                    (name, cat_type, color)
                )
            except Exception as e:
                logger.warning(f"Could not seed category '{name}': {e}")
                
        conn.commit()
        logger.info("Default categories seeded in PostgreSQL.")
        
    except Exception as e:
        logger.error(f"Failed to initialize PostgreSQL database: {e}")
        if conn:
            conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def init_mysql_db():
    """Initialize MySQL database structure (Local development environment)."""
    # Create database first
    conn = None
    cursor = None
    try:
        conn = get_connection(include_db=False)
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        logger.info(f"Database '{DB_NAME}' verified/created.")
    except MySQLError as e:
        logger.error(f"Failed to create database: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    # Create tables and seed data
    conn = None
    cursor = None
    try:
        conn = get_connection(include_db=True)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                token VARCHAR(64) PRIMARY KEY,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type ENUM('income', 'expense') NOT NULL,
                user_id INT NULL,
                color VARCHAR(20) DEFAULT '#cccccc',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_category_name_per_user (name, type, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                category_id INT NULL,
                type ENUM('income', 'expense') NOT NULL,
                amount DECIMAL(12, 2) NOT NULL,
                description VARCHAR(255) NULL,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        
        conn.commit()
        logger.info("MySQL tables verified/created.")
        
        # Seed default user with ID 1
        cursor.execute("""
            INSERT IGNORE INTO users (id, username, email, password_hash)
            VALUES (1, 'default', 'default@example.com', 'default')
        """)
        conn.commit()
        
        default_categories = [
            ("Salary", "income", "#10B981"),
            ("Freelance", "income", "#34D399"),
            ("Investment", "income", "#6EE7B7"),
            ("Gifts", "income", "#A7F3D0"),
            ("Other Income", "income", "#059669"),
            ("Housing", "expense", "#EF4444"),
            ("Food & Groceries", "expense", "#F59E0B"),
            ("Utilities", "expense", "#3B82F6"),
            ("Transportation", "expense", "#EC4899"),
            ("Entertainment", "expense", "#8B5CF6"),
            ("Shopping", "expense", "#D946EF"),
            ("Healthcare", "expense", "#10B981"),
            ("Education", "expense", "#6366F1"),
            ("Other Expense", "expense", "#6B7280"),
        ]
        
        for name, cat_type, color in default_categories:
            try:
                cursor.execute(
                    "INSERT IGNORE INTO categories (name, type, user_id, color) VALUES (%s, %s, NULL, %s)",
                    (name, cat_type, color)
                )
            except MySQLError as e:
                logger.warning(f"Could not seed category '{name}': {e}")
                
        conn.commit()
        logger.info("Default categories seeded in MySQL.")
        
    except MySQLError as e:
        logger.error(f"Failed to initialize MySQL database tables: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def query_db(query, args=(), one=False, commit=False):
    """Execute a SQL query and return results (as list of dicts) or lastrowid/rowcount."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        
        if IS_POSTGRES:
            # Use RealDictCursor to automatically get list of dictionaries from PostgreSQL
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute(query, args)
            
            if commit:
                conn.commit()
                # For PostgreSQL, lastrowid is obtained via RETURNING in query, but standard operations return rowcount
                result = cursor.rowcount
            else:
                rv = cursor.fetchall()
                # RealDictCursor fetches dictionaries, but we need to convert them to normal dicts to avoid serialization issues
                rv_normal = [dict(row) for row in rv]
                result = (rv_normal[0] if rv_normal else None) if one else rv_normal
        else:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, args)
            
            if commit:
                conn.commit()
                result = cursor.lastrowid if cursor.lastrowid != 0 else cursor.rowcount
            else:
                rv = cursor.fetchall()
                result = (rv[0] if rv else None) if one else rv
                
        return result
    except Exception as e:
        logger.error(f"Database query error: {e}\nQuery: {query}\nArgs: {args}")
        if conn and commit:
            conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
