import mysql.connector
from mysql.connector import Error, pooling
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Connection details verified from the environment check
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "password"
}
DB_NAME = "personal_finance_db"

connection_pool = None

def get_connection(include_db=True):
    """Get a connection from the pool, or a direct connection if pool isn't initialized yet."""
    global connection_pool
    config = DB_CONFIG.copy()
    if include_db:
        config["database"] = DB_NAME
        
    try:
        if include_db:
            # Initialize pool with database name on first database connection request
            if connection_pool is None:
                connection_pool = mysql.connector.pooling.MySQLConnectionPool(
                    pool_name="finance_pool",
                    pool_size=5,
                    **config
                )
            return connection_pool.get_connection()
        else:
            return mysql.connector.connect(**config)
    except Error as e:
        logger.error(f"Error connecting to MySQL: {e}")
        raise e

def init_db():
    """Create database, tables, and seed initial data if they don't exist."""
    # 1. Create database if it doesn't exist
    conn = None
    cursor = None
    try:
        conn = get_connection(include_db=False)
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        logger.info(f"Database '{DB_NAME}' verified/created.")
    except Error as e:
        logger.error(f"Failed to create database: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    # 2. Connect to the database and create tables
    conn = None
    cursor = None
    try:
        conn = get_connection(include_db=True)
        cursor = conn.cursor()
        
        # Enable multi-statement execution if needed, but running individually is safer
        tables = {}
        
        tables["users"] = """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        tables["user_sessions"] = """
            CREATE TABLE IF NOT EXISTS user_sessions (
                token VARCHAR(64) PRIMARY KEY,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        tables["categories"] = """
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type ENUM('income', 'expense') NOT NULL,
                user_id INT NULL,
                color VARCHAR(20) DEFAULT '#cccccc',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_category_name_per_user (name, type, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        tables["transactions"] = """
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
        """

        for name, ddl in tables.items():
            cursor.execute(ddl)
            logger.info(f"Table '{name}' verified/created.")
            
        conn.commit()
        
        # 3. Seed default categories
        default_categories = [
            # Incomes
            ("Salary", "income", "#10B981"),
            ("Freelance", "income", "#34D399"),
            ("Investment", "income", "#6EE7B7"),
            ("Gifts", "income", "#A7F3D0"),
            ("Other Income", "income", "#059669"),
            # Expenses
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
                # Use INSERT IGNORE to skip duplicates due to unique constraint
                cursor.execute(
                    "INSERT IGNORE INTO categories (name, type, user_id, color) VALUES (%s, %s, NULL, %s)",
                    (name, cat_type, color)
                )
            except Error as e:
                # Log warning but don't fail initialization
                logger.warning(f"Could not seed category '{name}': {e}")
                
        conn.commit()
        logger.info("Default categories seeded successfully.")
        
    except Error as e:
        logger.error(f"Failed to initialize database tables: {e}")
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def query_db(query, args=(), one=False, commit=False):
    """Execute a SQL query and return results or lastrowid/rowcount."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        # Use dictionary=True so that query results are returned as dicts
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, args)
        
        if commit:
            conn.commit()
            result = cursor.lastrowid if cursor.lastrowid != 0 else cursor.rowcount
        else:
            rv = cursor.fetchall()
            result = (rv[0] if rv else None) if one else rv
            
        return result
    except Error as e:
        logger.error(f"Database query error: {e}\nQuery: {query}\nArgs: {args}")
        if conn and commit:
            conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
